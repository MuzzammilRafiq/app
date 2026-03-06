import { ASK_IMAGE } from "../services/model.js";
import { GRID_SIZE } from "./utils.js";
import type {
  SendLogFn,
  CellIdentificationResult,
  NextActionDecision,
  VerificationResult,
  ActionHistoryEntry,
} from "./utils.js";
import {
  createContextualPlanPrompt,
  createNextActionPrompt,
  createVerificationPrompt,
} from "../prompts/automation.js";
import { LOG, truncate, truncateLines } from "../utils/logging.js";

const TAG = "automation:llm-helpers";

export async function askLLMForCellWithLogging(
  apiKey: string,
  cleanImageBase64: string,
  gridImageBase64: string,
  prompt: string,
  targetDescription: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn,
  controller: AbortController,
): Promise<CellIdentificationResult> {
  try {
    const response = ASK_IMAGE(
      apiKey,
      prompt,
      [cleanImageBase64, gridImageBase64],
      {
        overrideModel: imageModelOverride,
        controller,
      },
    );

    let responseContent = "";
    let thinkingContent = "";
    for await (const chunk of response) {
      if (chunk.reasoning) {
        thinkingContent += chunk.reasoning;
      }
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    if (thinkingContent) {
      sendLog("thinking", "Model Thinking", thinkingContent);
    }

    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      sendLog(
        "error",
        "Parse Error",
        `Could not parse LLM response: ${truncateLines(responseContent, 1600, 24)}`,
      );
      throw new Error(`Could not parse LLM response: ${truncate(responseContent, 600)}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Ensure status field exists (backward compatibility)
    if (!parsed.status) {
      parsed.status = parsed.cell === 0 ? "not_found" : "found";
    }

    const prettyResponse = `Cell: ${parsed.cell}\nStatus: ${parsed.status}\nConfidence: ${parsed.confidence}\nReason: ${parsed.reason}${parsed.suggested_retry ? `\nSuggested retry: ${parsed.suggested_retry}` : ""}`;

    if (parsed.status === "not_found" || parsed.status === "ambiguous") {
      sendLog("vision-status", `Vision: ${parsed.status}`, prettyResponse);
    } else {
      sendLog("llm-response", "LLM Response", prettyResponse);
    }

    if (parsed.status === "not_found" || parsed.status === "ambiguous") {
      return {
        cell: 0,
        confidence: parsed.confidence || "none",
        reason:
          parsed.reason ||
          `Element matching "${targetDescription}" ${parsed.status === "ambiguous" ? "is ambiguous" : "was not found"}`,
        status: parsed.status,
        suggested_retry: parsed.suggested_retry,
      };
    }

    if (
      typeof parsed.cell !== "number" ||
      parsed.cell < 1 ||
      parsed.cell > GRID_SIZE * GRID_SIZE
    ) {
      const errMsg = `Invalid cell number: ${parsed.cell}`;
      sendLog("error", "Invalid Response", errMsg);
      throw new Error(errMsg);
    }

    return {
      cell: parsed.cell,
      confidence: parsed.confidence,
      reason: parsed.reason,
      status: "found",
      suggested_retry: parsed.suggested_retry,
    };
  } catch (error) {
    LOG(TAG).ERROR("Failed to identify cell from LLM response", {
      targetDescription: truncate(targetDescription, 200),
      model: imageModelOverride,
    }, error);
    return {
      cell: 0,
      confidence: "none",
      reason: "Failed to parse LLM response",
      status: "not_found",
    };
  }
}

export async function askLLMForContextualPlan(
  apiKey: string,
  imageBase64: string,
  userGoal: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn,
  controller: AbortController,
): Promise<{
  valid: boolean;
  plan?: string;
  estimatedSteps?: number;
  reason?: string;
}> {
  try {
    sendLog(
      "llm-request",
      "Contextual Planning",
      "Analyzing screen and creating plan...",
    );

    const prompt = createContextualPlanPrompt(userGoal);
    let responseContent = "";
    let thinkingContent = "";

    const plan = ASK_IMAGE(apiKey, prompt, [imageBase64], {
      overrideModel: imageModelOverride,
      controller,
    });

    for await (const chunk of plan) {
      if (chunk.reasoning) {
        thinkingContent += chunk.reasoning;
      }
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    if (thinkingContent) {
      sendLog("thinking", "Planning Reasoning", thinkingContent);
    }

    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      sendLog(
        "error",
        "Parse Error",
        `Could not parse plan: ${truncateLines(responseContent, 1600, 24)}`,
      );
      throw new Error("Failed to parse contextual plan");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.valid) {
      sendLog("llm-response", "Plan Created", parsed.plan);
    } else {
      sendLog(
        "error",
        "Context Invalid",
        parsed.reason || "Cannot achieve goal from current screen",
      );
    }

    return parsed;
  } catch (error) {
    LOG(TAG).ERROR("Failed to build contextual plan", {
      userGoal: truncate(userGoal, 300),
      model: imageModelOverride,
    }, error);
    return {
      valid: false,
      reason: "Something went wrong while creating plan",
    };
  }
}

export async function askLLMForNextAction(
  apiKey: string,
  imageBase64: string,
  goal: string,
  plan: string,
  actionHistory: ActionHistoryEntry[],
  imageModelOverride: string | undefined,
  sendLog: SendLogFn,
  controller: AbortController,
): Promise<NextActionDecision> {
  try {
    sendLog(
      "llm-request",
      "Deciding Next Action",
      `Step ${actionHistory.length + 1}`,
    );

    const prompt = createNextActionPrompt(goal, plan, actionHistory);
    let responseContent = "";
    let thinkingContent = "";

    for await (const chunk of ASK_IMAGE(apiKey, prompt, [imageBase64], {
      overrideModel: imageModelOverride,
      controller: controller,
    })) {
      if (chunk.reasoning) {
        thinkingContent += chunk.reasoning;
      }
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    if (thinkingContent) {
      sendLog("thinking", "Decision Reasoning", thinkingContent);
    }

    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      sendLog(
        "error",
        "Parse Error",
        `Could not parse action decision: ${truncateLines(responseContent, 1600, 24)}`,
      );
      throw new Error("Failed to parse next action decision");
    }

    const parsed: NextActionDecision = JSON.parse(jsonMatch[0]);

    const actionDesc =
      parsed.action === "done"
        ? "Goal Complete!"
        : `${parsed.action}${parsed.target ? ` -> "${parsed.target}"` : ""}${parsed.data ? ` (${parsed.data})` : ""}`;
    sendLog(
      "llm-response",
      "Next Action",
      `${actionDesc}\nReason: ${parsed.reason}`,
    );

    return parsed;
  } catch (error) {
    LOG(TAG).ERROR("Failed to decide next action", {
      goal: truncate(goal, 300),
      planPreview: truncateLines(plan, 800, 12),
      actionHistoryLength: actionHistory.length,
      model: imageModelOverride,
    }, error);
    return {
      action: "error",
      goalComplete: false,
      reason:
        error instanceof Error
          ? error.message
          : "Something went wrong while deciding next action",
    };
  }
}

export async function askLLMForVerification(
  apiKey: string,
  imageBase64: string,
  action: string,
  target: string | undefined,
  data: string | undefined,
  expectedResult: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn,
  controller: AbortController,
): Promise<VerificationResult> {
  try {
    sendLog(
      "llm-request",
      "Verifying Action",
      `Checking if ${action} succeeded...`,
    );

    const prompt = createVerificationPrompt(
      action,
      target,
      data,
      expectedResult,
    );
    let responseContent = "";
    const response = ASK_IMAGE(apiKey, prompt, [imageBase64], {
      overrideModel: imageModelOverride,
      controller,
    });

    for await (const chunk of response) {
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Default to success if parsing fails (don't block on verification errors)
      sendLog(
        "error",
        "Parse Error",
        `Could not parse verification: ${truncateLines(responseContent, 1600, 24)}`,
      );
      return {
        success: true,
        observation: "Verification parse failed, assuming success",
      };
    }

    const parsed: VerificationResult = JSON.parse(jsonMatch[0]);

    sendLog(
      parsed.success ? "llm-response" : "error",
      parsed.success ? "Verification Passed" : "Verification Failed",
      parsed.observation +
        (parsed.suggestion ? `\nSuggestion: ${parsed.suggestion}` : ""),
    );

    return parsed;
  } catch (error) {
    LOG(TAG).ERROR("Verification call failed", {
      action,
      target: target ? truncate(target, 200) : undefined,
      data: data ? truncate(data, 200) : undefined,
      expectedResult: truncateLines(expectedResult, 500, 8),
      model: imageModelOverride,
    }, error);
    return {
      success: true,
      observation: "Verification failed due to error, assuming success",
    };
  }
}
