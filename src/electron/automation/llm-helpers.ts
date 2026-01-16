/**
 * LLM helper functions for automation
 */

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { ASK_IMAGE, ASK_TEXT, type ChatMessage } from "../services/model.js";
import { GRID_SIZE, MAX_ORCHESTRATOR_STEPS } from "./types.js";
import type {
  SendLogFn,
  CellIdentificationResult,
  OrchestratorStep,
  NextActionDecision,
  VerificationResult,
  ActionHistoryEntry,
} from "./types.js";

export async function askLLMForCell(
  apiKey: string,
  imageBase64: string,
  prompt: string,
  targetDescription: string,
  imageModelOverride?: string
): Promise<CellIdentificationResult> {
  // Save base64 to temp file
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `vision-click-${Date.now()}.png`);

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    let responseContent = "";

    for await (const chunk of ASK_IMAGE(apiKey, prompt, [tempFilePath], {
      overrideModel: imageModelOverride,
    })) {
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    // Parse JSON
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not parse LLM response: ${responseContent}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Check if element was not found (cell: 0)
    if (parsed.cell === 0) {
      throw new Error(
        `Element not found: ${parsed.reason || `No element matching "${targetDescription}" was found on the screen`}`
      );
    }

    if (
      typeof parsed.cell !== "number" ||
      parsed.cell < 1 ||
      parsed.cell > GRID_SIZE * GRID_SIZE
    ) {
      throw new Error(`Invalid cell number: ${parsed.cell}`);
    }

    return parsed;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
  }
}

export async function askLLMForCellWithLogging(
  apiKey: string,
  cleanImageBase64: string,
  gridImageBase64: string,
  prompt: string,
  targetDescription: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn
): Promise<CellIdentificationResult> {
  // Save both images to temp files
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const cleanFilePath = path.join(tempDir, `vision-clean-${timestamp}.png`);
  const gridFilePath = path.join(tempDir, `vision-grid-${timestamp}.png`);

  try {
    // Write both images
    const cleanBuffer = Buffer.from(cleanImageBase64, "base64");
    const gridBuffer = Buffer.from(gridImageBase64, "base64");
    await fs.writeFile(cleanFilePath, cleanBuffer);
    await fs.writeFile(gridFilePath, gridBuffer);

    let responseContent = "";
    let thinkingContent = "";

    // Send BOTH images: clean first, then grid with numbers
    for await (const chunk of ASK_IMAGE(
      apiKey,
      prompt,
      [cleanFilePath, gridFilePath],
      {
        overrideModel: imageModelOverride,
      }
    )) {
      // Check for reasoning/thinking content (some models return this)
      if (chunk.reasoning) {
        thinkingContent += chunk.reasoning;
        // Only log thinking once at the end, not during streaming
      }

      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    // Log thinking content if present (only once, after completion)
    if (thinkingContent) {
      sendLog("thinking", "Model Thinking", thinkingContent);
    }

    // Parse JSON
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      sendLog(
        "error",
        "Parse Error",
        `Could not parse LLM response: ${responseContent}`
      );
      throw new Error(`Could not parse LLM response: ${responseContent}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Ensure status field exists (backward compatibility)
    if (!parsed.status) {
      parsed.status = parsed.cell === 0 ? "not_found" : "found";
    }

    // Log the parsed response in a pretty format with status
    const prettyResponse = `Cell: ${parsed.cell}\nStatus: ${parsed.status}\nConfidence: ${parsed.confidence}\nReason: ${parsed.reason}${parsed.suggested_retry ? `\nSuggested retry: ${parsed.suggested_retry}` : ""}`;

    // Use vision-status log type for not_found/ambiguous
    if (parsed.status === "not_found" || parsed.status === "ambiguous") {
      sendLog("vision-status", `Vision: ${parsed.status}`, prettyResponse);
    } else {
      sendLog("llm-response", "LLM Response", prettyResponse);
    }

    // For not_found/ambiguous, return the result instead of throwing
    // This allows the caller (text model planner) to decide what to do
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

    // Validate cell number for found status
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
  } finally {
    // Clean up both temp files
    try {
      await fs.unlink(cleanFilePath);
    } catch {}
    try {
      await fs.unlink(gridFilePath);
    } catch {}
  }
}

export const createCellIdentificationPrompt = (
  targetDescription: string,
  isRefinement: boolean = false
) => `You are a vision assistant that identifies UI elements in screenshots.

You are provided with TWO images:
1. FIRST IMAGE: A clean ${isRefinement ? "zoomed-in section" : "screenshot"} without any overlay
2. SECOND IMAGE: The same ${isRefinement ? "section" : "screenshot"} with a ${GRID_SIZE}x${GRID_SIZE} numbered grid overlay (cells 1-${GRID_SIZE * GRID_SIZE})

The user wants to click on: "${targetDescription}"

Use the FIRST (clean) image to clearly see all UI elements without obstruction.
Use the SECOND (grid) image to identify which numbered cell contains your target.

Instructions:
1. Find the target element in the clean image
2. Match its position to a cell number in the grid image
3. If the element spans multiple cells, pick ANY cell that contains part of it
4. If the element is NOT visible on screen, respond with status: "not_found" and cell: 0
5. If the screen shows a loading state, spinner, or transition, respond with status: "not_found"
6. If multiple elements match or you're uncertain, respond with status: "ambiguous" and cell: 0
7. DO NOT GUESS a cell number if you are unsure - use "not_found" or "ambiguous" instead

Respond with ONLY a JSON object:
{
  "cell": <number 1-${GRID_SIZE * GRID_SIZE} or 0 if not found>,
  "confidence": "<high|medium|low|none>",
  "status": "<found|not_found|ambiguous>",
  "reason": "<brief explanation>",
  "suggested_retry": "<optional hint for retry if not_found/ambiguous>"
}

Examples:
{"cell": 15, "confidence": "high", "status": "found", "reason": "Found 'Settings' button in cell 15"}
{"cell": 0, "confidence": "none", "status": "not_found", "reason": "Page is still loading, showing spinner"}
{"cell": 0, "confidence": "low", "status": "ambiguous", "reason": "Multiple settings icons visible", "suggested_retry": "Try specifying 'gear icon in top right'"}`;

export const createScreenDescriptionPrompt = (
  userPrompt: string
) => `You are a screen context analyzer.
The user wants to: "${userPrompt}"

Analyze the screenshot and provide a concise description of the visible state.
1. Is the application or website required for the user's task visible?
2. List key interactive elements visible on the screen that are relevant to the task (e.g., search bars, specific buttons, menus, input fields).
3. If the required context is NOT visible, describe clearly what is shown instead.

Keep your response factual and concise. Do not generate a plan, just describe the screen context.`;

export const createPlanGenerationPrompt = (
  userPrompt: string,
  screenDescription: string
) => `You are a browser automation assistant. Given the user's request and a description of the screen state, generate a step-by-step plan to achieve the goal.

User request: "${userPrompt}"
Screen Context: "${screenDescription}"

FIRST, evaluate if the screen context is sufficient for the request.
If the required app/website is clearly NOT visible based on the description, respond with:
{"error": "Target not visible", "reason": "explanation based on context"}

If the context IS correct, return a JSON object with a "steps" array:
{
  "steps": [
    {"action": "click", "target": "element description", "reason": "why this step"},
    {"action": "type", "target": "input field description", "data": "text to type", "reason": "why"},
    {"action": "press", "data": "enter", "reason": "submit the form"},
    {"action": "wait", "data": "2000", "reason": "wait for page to load"}
  ]
}

Rules:
- Use "click" to click on elements - describe the element clearly so a vision system can find it
- Use "type" to enter text - specify target input and data to type
- Use "press" for keyboard keys (enter, tab, escape, backspace, up, down, left, right, space)
- Use "wait" for delays (specify ms, typically 1500-2000 for page loads)
- Use "scroll" to scroll the page - data should be "up" or "down" with optional pixels (e.g., "down 300")
- Add wait steps after actions that trigger page loads
- Keep plans simple - maximum ${MAX_ORCHESTRATOR_STEPS} steps
- For typing in search boxes: click the input, then use a separate type step
- IMPORTANT: After typing in a search box or input field, ALWAYS use "press" with "enter" to submit - do NOT click a search button. Pressing Enter is faster and more reliable.

Respond with ONLY the JSON object, no other text.`;

export async function askLLMForPlanWithLogging(
  apiKey: string,
  imageBase64: string,
  userPrompt: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn
): Promise<{ steps?: OrchestratorStep[]; error?: string; reason?: string }> {
  // Step 1: Use Vision Model to get screen description
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(
    tempDir,
    `orchestrator-plan-${Date.now()}.png`
  );

  let screenDescription = "";

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    sendLog(
      "llm-request",
      "Scene Analysis",
      "Asking Vision Model to analyze screen content..."
    );

    const descPrompt = createScreenDescriptionPrompt(userPrompt);
    for await (const chunk of ASK_IMAGE(apiKey, descPrompt, [tempFilePath], {
      overrideModel: imageModelOverride,
    })) {
      if (chunk.content) {
        screenDescription += chunk.content;
      }
    }

    sendLog("llm-response", "Screen Analysis", screenDescription);

    // Step 2: Use Text Model to generate plan
    sendLog(
      "llm-request",
      "Plan Generation",
      "Asking Text Model to generate plan..."
    );

    const planPrompt = createPlanGenerationPrompt(
      userPrompt,
      screenDescription
    );
    const messages: ChatMessage[] = [{ role: "user", content: planPrompt }];

    let responseContent = "";
    let thinkingContent = "";

    for await (const chunk of ASK_TEXT(apiKey, messages)) {
      if (chunk.reasoning) {
        thinkingContent += chunk.reasoning;
      }
      if (chunk.content) {
        responseContent += chunk.content;
      }
    }

    if (thinkingContent) {
      sendLog("thinking", "Planner Thinking", thinkingContent);
    }

    // Parse JSON from response
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      sendLog(
        "error",
        "Parse Error",
        `Could not parse Planner response: ${responseContent}`
      );
      throw new Error(`Could not parse plan response: ${responseContent}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
  }
}

// ============================================
// Robust Orchestrator Prompts & Functions
// ============================================

/**
 * Creates a prompt for generating a contextual (natural language) plan
 */
export const createContextualPlanPrompt = (
  userGoal: string
) => `You are a screen automation assistant. Analyze this screenshot and create a plan to achieve the user's goal.

User Goal: "${userGoal}"

First, validate if the goal can be achieved from the current screen state.
If the required application or context is NOT visible, respond with:
{"valid": false, "reason": "explanation of what's missing"}

If the context IS valid, describe your plan in natural language. This should be a clear, step-by-step description that will guide subsequent actions.

Respond with a JSON object:
{
  "valid": true,
  "plan": "To achieve this, I will: [describe the logical steps in natural language, e.g., 'First, I'll click on the search bar at the top of the page. Then I'll type the search query. Finally, I'll press Enter to submit the search.']",
  "estimatedSteps": <number between 1 and 10>
}

Keep the plan concise but complete. Focus on what needs to be done, not technical details.`;

/**
 * Creates a prompt for deciding the next action
 */
export const createNextActionPrompt = (
  goal: string,
  plan: string,
  actionHistory: ActionHistoryEntry[]
) => {
  const historyText =
    actionHistory.length > 0
      ? actionHistory
          .map(
            (h, i) =>
              `Step ${i + 1}: ${h.action}${h.target ? ` on "${h.target}"` : ""}${h.data ? ` with "${h.data}"` : ""} -> ${h.success ? "Success" : "Failed"}: ${h.observation}`
          )
          .join("\n")
      : "No actions taken yet.";

  return `You are a screen automation sub-agent. Based on the current screen state, decide the SINGLE next action to take.

GOAL: "${goal}"

PLAN: ${plan}

ACTIONS SO FAR:
${historyText}

Analyze the screenshot and determine:
1. What is currently visible on screen?
2. Based on the plan and actions taken, what is the NEXT single action needed?
3. Is the goal already complete?

Respond with a JSON object:
{
  "action": "click" | "type" | "press" | "wait" | "scroll" | "done",
  "target": "element description (for click/type)" or null,
  "data": "text to type / key to press / wait ms / scroll direction" or null,
  "reason": "brief explanation of why this action",
  "goalComplete": true | false
}

Rules:
- Only return ONE action
- If goal is complete, use action: "done" with goalComplete: true
- For "click": describe the target element clearly (e.g., "the search bar at the top", "the blue Submit button")
- For "type": target is the input field, data is the text to type
- For "press": data is the key (enter, tab, escape, space, etc.)
- For "wait": data is milliseconds (e.g., "1500")
- For "scroll": data is direction with optional pixels (e.g., "down", "up 300")
- If a previous vision step returned "not_found" or "ambiguous", consider: waiting for loading, scrolling to reveal content, or trying a different target description

Respond with ONLY the JSON object.`;
};

/**
 * Creates a prompt for verifying if an action succeeded
 */
export const createVerificationPrompt = (
  action: string,
  target: string | undefined,
  data: string | undefined,
  expectedResult: string
) => `You are verifying if an automation action succeeded.

ACTION PERFORMED: ${action}${target ? ` on "${target}"` : ""}${data ? ` with data "${data}"` : ""}

EXPECTED RESULT: ${expectedResult}

Analyze the screenshot and determine if the action was successful.

Respond with a JSON object:
{
  "success": true or false,
  "observation": "describe what you see (e.g., 'cursor is now in the search bar', 'text was typed correctly', 'search results are loading')",
  "suggestion": "if failed, suggest how to retry (e.g., 'try clicking slightly to the right')" or null
}

Be objective - only mark success if you can clearly see evidence the action worked.`;

/**
 * Ask LLM for a contextual plan (natural language)
 */
export async function askLLMForContextualPlan(
  apiKey: string,
  imageBase64: string,
  userGoal: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn
): Promise<{
  valid: boolean;
  plan?: string;
  estimatedSteps?: number;
  reason?: string;
}> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `contextual-plan-${Date.now()}.png`);

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    sendLog(
      "llm-request",
      "Contextual Planning",
      "Analyzing screen and creating plan..."
    );

    const prompt = createContextualPlanPrompt(userGoal);
    let responseContent = "";
    let thinkingContent = "";

    for await (const chunk of ASK_IMAGE(apiKey, prompt, [tempFilePath], {
      overrideModel: imageModelOverride,
    })) {
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
        `Could not parse plan: ${responseContent}`
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
        parsed.reason || "Cannot achieve goal from current screen"
      );
    }

    return parsed;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
  }
}

/**
 * Ask LLM to decide the next action
 */
export async function askLLMForNextAction(
  apiKey: string,
  imageBase64: string,
  goal: string,
  plan: string,
  actionHistory: ActionHistoryEntry[],
  imageModelOverride: string | undefined,
  sendLog: SendLogFn
): Promise<NextActionDecision> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `next-action-${Date.now()}.png`);

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    sendLog(
      "llm-request",
      "Deciding Next Action",
      `Step ${actionHistory.length + 1}`
    );

    const prompt = createNextActionPrompt(goal, plan, actionHistory);
    let responseContent = "";
    let thinkingContent = "";

    for await (const chunk of ASK_IMAGE(apiKey, prompt, [tempFilePath], {
      overrideModel: imageModelOverride,
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
        `Could not parse action decision: ${responseContent}`
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
      `${actionDesc}\nReason: ${parsed.reason}`
    );

    return parsed;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
  }
}

/**
 * Ask LLM to verify if an action succeeded
 */
export async function askLLMForVerification(
  apiKey: string,
  imageBase64: string,
  action: string,
  target: string | undefined,
  data: string | undefined,
  expectedResult: string,
  imageModelOverride: string | undefined,
  sendLog: SendLogFn
): Promise<VerificationResult> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `verification-${Date.now()}.png`);

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(tempFilePath, buffer);

    sendLog(
      "llm-request",
      "Verifying Action",
      `Checking if ${action} succeeded...`
    );

    const prompt = createVerificationPrompt(
      action,
      target,
      data,
      expectedResult
    );
    let responseContent = "";

    for await (const chunk of ASK_IMAGE(apiKey, prompt, [tempFilePath], {
      overrideModel: imageModelOverride,
    })) {
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
        `Could not parse verification: ${responseContent}`
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
        (parsed.suggestion ? `\nSuggestion: ${parsed.suggestion}` : "")
    );

    return parsed;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
  }
}
