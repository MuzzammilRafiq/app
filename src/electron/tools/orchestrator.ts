import { type ChatMessage } from "../services/model.js";
import { LOG } from "../utils/logging.js";
import {
  ChatExecutionContext,
  ChatMessageRecord,
  PlannerResult,
} from "../../common/types.js";
import { IpcMainInvokeEvent } from "electron";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { stepCountIs, streamText } from "ai";
import { buildChatExecutionTools } from "./chat-tools/index.js";
import { sendChatChunk } from "../utils/chat-stream.js";

const TAG = "orchestrator";

const PLANNER_SYSTEM_PROMPT = `You are the planning pass for a desktop AI chat agent running on macOS.

Your job is to produce a short, user-visible markdown plan before execution begins.

Rules:
- Always produce a plan, even for simple questions
- Write markdown, not JSON
- Keep it concise and practical
- Focus on intent, likely actions, and how success will be checked
- Do not mention hidden system details, schemas, or internal implementation
- Do not pretend work is already done
- If no tools are likely needed, say so plainly

Use this structure when possible:
## Goal
## Approach
## Potential tools
## Checks
`;

function buildExecutionSystemPrompt(context: ChatExecutionContext): string {
  const toolLines = context.availableTools
    .map((toolName) => `- ${toolName}`)
    .join("\n");

  return `You are a robust desktop chat agent running on macOS.

You have already been given a planner pass. Treat that plan as guidance, not as a rigid checklist. Adapt when tool outputs change the best next step.

Available tools:
${toolLines || "- none"}

Operating rules:
- Complete the user's request end-to-end when feasible
- Use tools when they materially help, and continue iterating until the task is done
- Avoid user-facing prose until you are ready to deliver the final answer
- If you need to narrate before a tool call, keep it to one short sentence
- Keep intermediate chatter minimal
- Do not invent tool results
- If a tool fails, reason about the failure and either recover or explain the blocker
- When the work is complete, provide a concise final summary for the user
- The final summary is the user-facing answer, so make it complete
`;
}

function toChatHistory(messages: ChatMessageRecord[]): ChatMessage[] {
  return messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "assistant",
    content: msg.content,
  }));
}

function sendChunk(
  event: IpcMainInvokeEvent & { requestId: string },
  sessionId: string,
  requestId: string,
  chunk: string,
  type: ChatMessageRecord["type"],
) {
  sendChatChunk(event.sender, { sessionId, requestId }, chunk, type);
}

async function generatePlanText(
  messages: ChatMessageRecord[],
  apiKey: string,
  event: IpcMainInvokeEvent & { requestId: string },
  sessionId: string,
  config: any,
  signal?: AbortSignal,
): Promise<PlannerResult> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const openrouter = createOpenRouter({ apiKey });
  const result = streamText({
    model: openrouter(config?.textModelOverride || "moonshotai/kimi-k2-0905"),
    abortSignal: signal,
    system: PLANNER_SYSTEM_PROMPT,
    messages: toChatHistory(messages),
  });

  let planText = "";
  sendChunk(event, sessionId, event.requestId, "Planning approach...\n", "log");

  for await (const part of result.fullStream) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    switch (part.type) {
      case "reasoning-delta": {
        sendChunk(event, sessionId, event.requestId, part.text, "log");
        break;
      }
      case "text-delta": {
        planText += part.text;
        sendChunk(event, sessionId, event.requestId, planText, "plan");
        break;
      }
      case "error": {
        LOG(TAG).ERROR("Planner stream error:", (part as any).error);
        break;
      }
    }
  }

  await result;

  const markdown = planText.trim();
  if (!markdown) {
    throw new Error("Planner produced an empty plan");
  }

  return { markdown };
}

function buildExecutionMessages(
  messages: ChatMessageRecord[],
  planText: string,
): ChatMessage[] {
  const history = toChatHistory(messages);
  const lastMessage = history[history.length - 1];

  if (!lastMessage || lastMessage.role !== "user") {
    return history;
  }

  history[history.length - 1] = {
    role: "user",
    content: `${lastMessage.content}\n\n<PLAN_GUIDANCE>\n${planText}\n</PLAN_GUIDANCE>\n\nUse the plan guidance above if it helps, but adapt to the actual tool outputs and conversation context.`,
  };

  return history;
}

async function executePlan(
  messages: ChatMessageRecord[],
  plan: PlannerResult,
  event: IpcMainInvokeEvent & { requestId: string },
  apiKey: string,
  sessionId: string,
  config: any,
  signal?: AbortSignal,
): Promise<{ output: string }> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const openrouter = createOpenRouter({ apiKey });
  const { tools, availableToolNames } = buildChatExecutionTools({
    event,
    sessionId,
    apiKey,
    config,
    signal,
  });

  const result = streamText({
    model: openrouter(config?.textModelOverride || "moonshotai/kimi-k2-0905"),
    abortSignal: signal,
    system: buildExecutionSystemPrompt({
      planText: plan.markdown,
      availableTools: availableToolNames,
    }),
    messages: buildExecutionMessages(messages, plan.markdown),
    tools,
    stopWhen: stepCountIs(20),
  });

  let finalText = "";
  let stepCount = 0;
  sendChunk(event, sessionId, event.requestId, "Executing plan...\n", "log");

  for await (const part of result.fullStream) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    switch (part.type) {
      case "start-step": {
        stepCount += 1;
        if (stepCount > 1) {
          sendChunk(
            event,
            sessionId,
            event.requestId,
            `\n--- Continuing execution step ${stepCount} ---\n`,
            "log",
          );
        }
        break;
      }
      case "reasoning-delta": {
        const reasoningContent =
          (part as any).text || (part as any).textDelta || "";
        if (reasoningContent) {
          sendChunk(event, sessionId, event.requestId, reasoningContent, "log");
        }
        break;
      }
      case "text-delta": {
        const textContent = (part as any).text || (part as any).textDelta || "";
        if (textContent) {
          finalText += textContent;
          sendChunk(event, sessionId, event.requestId, textContent, "general");
        }
        break;
      }
      case "tool-call": {
        sendChunk(event, sessionId, event.requestId, "\n", "log");
        break;
      }
      case "error": {
        sendChunk(
          event,
          sessionId,
          event.requestId,
          `\nError: ${(part as any).error}\n`,
          "log",
        );
        LOG(TAG).ERROR("Execution stream error:", (part as any).error);
        break;
      }
    }
  }

  await result;

  const output = finalText.trim();
  if (!output) {
    sendChunk(event, sessionId, event.requestId, "Task completed.", "general");
    return { output: "Task completed." };
  }

  return { output };
}

export async function orchestrate(
  messages: ChatMessageRecord[],
  event: IpcMainInvokeEvent & { requestId: string },
  apiKey: string,
  sessionId: string,
  config: any,
  signal?: AbortSignal,
): Promise<{ text: string; error?: string }> {
  try {
    const plan = await generatePlanText(
      messages,
      apiKey,
      event,
      sessionId,
      config,
      signal,
    );

    const result = await executePlan(
      messages,
      plan,
      event,
      apiKey,
      sessionId,
      config,
      signal,
    );

    return { text: result.output };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    LOG(TAG).ERROR("Failed to orchestrate chat:", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
