import { type ChatMessage } from "../services/model.js";
import dbService from "../services/database.js";
import { LOG } from "../utils/logging.js";
import {
  ChatMessageRecord,
  OrchestratorStep,
  OrchestratorContext,
} from "../../common/types.js";
import { IpcMainInvokeEvent } from "electron";
import { generalTool } from "./general/index.js";
import { StreamChunkBuffer } from "../utils/stream-buffer.js";
import os from "node:os";
import { terminalAgent } from "./terminal/index.js";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, Output } from "ai";
import * as z from "zod";

const TAG = "orchestrator";

const SYSTEM_PROMPT_PLANNER = `
You are a task orchestrator for a macOS system. Your job is to break down user requests into HIGH-LEVEL GOALS.

Available Agents:
1. terminal - Achieves a goal using shell commands. Describe WHAT to achieve, NOT specific commands.
   The terminal agent will figure out the exact commands, handle errors, and verify success automatically.
2. general - Provides natural language responses, summaries, and formatted output to the user

Rules:
- Output JSON only, matching the schema strictly
- Create GOAL-BASED steps for terminal (e.g., "Move file X to directory Y" NOT "mv X Y")
- Maximum 5 steps per plan (prefer fewer, broader steps)
- Always end with a "general" step to format the final response for the user
- If the request is a simple question or greeting, use only a "general" step
- For complex tasks, describe the complete goal - the terminal agent handles verification and error recovery
- Consider the conversation history for context
- The user will be asked to confirm each individual command during execution

Step Format:
- agent: "terminal" or "general"
- action: For terminal, describe the GOAL to achieve. For general, describe what to respond about.

Examples:

User: "What time is it?"
{
  "steps": [
    {"step_number": 1, "agent": "terminal", "action": "Get the current date and time"},
    {"step_number": 2, "agent": "general", "action": "Format the current date/time for the user"}
  ]
}

User: "Move test.txt from Downloads to Documents"
{
  "steps": [
    {"step_number": 1, "agent": "terminal", "action": "Move ~/Downloads/test.txt to ~/Documents/, creating the destination directory if it doesn't exist and verifying the move was successful"},
    {"step_number": 2, "agent": "general", "action": "Confirm the file was moved successfully"}
  ]
}

User: "Count folders in Downloads"
{
  "steps": [
    {"step_number": 1, "agent": "terminal", "action": "Count the number of directories in ~/Downloads (not recursive)"},
    {"step_number": 2, "agent": "general", "action": "Report the folder count to the user"}
  ]
}

User: "Create a new project folder with git initialized"
{
  "steps": [
    {"step_number": 1, "agent": "terminal", "action": "Create a new folder called 'new-project' in the current directory, initialize a git repository inside it, and create a basic .gitignore file"},
    {"step_number": 2, "agent": "general", "action": "Summarize what was created"}
  ]
}

User: "Hello!"
{
  "steps": [
    {"step_number": 1, "agent": "general", "action": "Greet the user warmly"}
  ]
}

IMPORTANT: Keep in mind that for agents give a proper action description eg if the user asks how many folders in A dont pass the action as it is check if there is any context about A in the previous messages and build the action around that context.
AND ALWAYS end with a general step to format the final response for the user.
`;

async function generatePlan(
  messages: ChatMessageRecord[],
  apiKey: string,
  event: IpcMainInvokeEvent,
  sessionId: string,
  config: any,
  signal?: AbortSignal,
): Promise<{ steps: OrchestratorStep[]; error?: string }> {
  try {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const openrouter = createOpenRouter({ apiKey: apiKey });
    const chatHistory: ChatMessage[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const result = streamText({
      model: openrouter(config?.textModelOverride || "moonshotai/kimi-k2-0905"),
      abortSignal: signal,
      system: SYSTEM_PROMPT_PLANNER,
      prompt: chatHistory,
      output: Output.array({
        element: z.object({
          step_number: z
            .number()
            .describe("Sequential step number starting from 1"),
          agent: z
            .enum(["terminal", "general"])
            .describe("The agent to execute this step"),
          action: z
            .string()
            .describe(
              "For terminal: goal to achieve. For general: task description",
            ),
        }),
      }),
    });

    const buffer = new StreamChunkBuffer(event.sender, sessionId);
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "reasoning-delta": {
          buffer.send(part.text, "log");
          break;
        }
        case "error": {
          buffer.send(`\nError: ${(part as any).error}\n`, "log");
          LOG(TAG).ERROR("Stream error:", (part as any).error);
          break;
        }
      }
    }
    buffer.flush();
    const output = await result.output;
    const steps: OrchestratorStep[] = output.map((s) => ({
      step_number: s.step_number,
      agent: s.agent,
      action: s.action,
      status: "pending" as const,
    }));
    LOG(TAG).INFO(`Generated plan with ${steps.length} steps`);
    return { steps };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    LOG(TAG).ERROR("Failed to generate plan:", error);
    return {
      steps: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function executeGeneralStep(
  step: OrchestratorStep,
  messages: ChatMessageRecord[],
  context: OrchestratorContext,
  event: IpcMainInvokeEvent,
  apiKey: string,
  config: any,
  signal?: AbortSignal,
): Promise<{ output: string }> {
  // Build context summary from all previous steps
  const contextSummary =
    context.history.length > 0
      ? "\n\n<EXECUTION_RESULTS>\n" +
        context.history
          .map((h) => `[Step ${h.step}]: ${h.command}\nOutput: ${h.output}`)
          .join("\n\n") +
        "\n</EXECUTION_RESULTS>"
      : "";

  return generalTool(
    messages,
    step.action + contextSummary,
    event,
    apiKey,
    config,
    signal,
  );
}

export async function orchestrate(
  messages: ChatMessageRecord[],
  event: IpcMainInvokeEvent,
  apiKey: string,
  sessionId: string,
  config: any,
  signal?: AbortSignal,
): Promise<{ text: string; error?: string }> {
  LOG(TAG).INFO("Starting orchestration");
  const planResult = await generatePlan(
    messages,
    apiKey,
    event,
    sessionId,
    config,
    signal,
  );

  if (planResult.error || planResult.steps.length === 0) {
    return {
      text: "",
      error: planResult.error || "No plan steps generated",
    };
  }

  const steps = planResult.steps;

  // Prepare plan payload
  const planPayload = steps.map((s) => ({
    step_number: s.step_number,
    tool_name: s.agent === "terminal" ? "terminal_tool" : "general_tool",
    description: s.action,
    status: "todo" as const,
  }));

  // Compute plan hash (must match renderer logic)
  const djb2Hash = (str: string): string => {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  };
  const planHash = djb2Hash(JSON.stringify(planPayload));

  // Persist initial plan steps
  try {
    dbService.upsertPlanSteps(sessionId, planHash, planPayload);
  } catch {}

  // Send plan to UI
  event.sender.send("stream-chunk", {
    chunk: JSON.stringify(planPayload, null, 2),
    type: "plan",
    sessionId,
  });
  // Artificial delay to simulate processing time

  // Initialize execution context
  const context: OrchestratorContext = {
    goal: messages[messages.length - 1]?.content || "",
    cwd: os.homedir(),
    currentStep: 0,
    steps,
    history: [],
    done: false,
  };

  let finalOutput = "";

  // Execute each step
  for (let i = 0; i < steps.length; i++) {
    // Check cancellation before starting step
    if (signal?.aborted) {
      LOG(TAG).INFO("Orchestration aborted by user");
      // Optionally throw to stop completely
      throw new DOMException("Aborted", "AbortError");
    }

    const step = steps[i];
    context.currentStep = step.step_number;
    step.status = "running";

    // Emit plan with running status
    event.sender.send("stream-chunk", {
      chunk: JSON.stringify(
        steps.map((s) => ({
          step_number: s.step_number,
          tool_name: s.agent === "terminal" ? "terminal_tool" : "general_tool",
          description: s.action,
          status: s.status === "pending" ? "todo" : s.status,
        })),
        null,
        2,
      ),
      type: "plan",
      sessionId,
    });

    event.sender.send("stream-chunk", {
      chunk: `\n📍 Step ${step.step_number}: [${step.agent}] ${step.action}\n`,
      type: "log",
      sessionId,
    });

    if (step.agent === "terminal") {
      const result = await terminalAgent(
        step.action,
        event,
        apiKey,
        20,
        config.textModelOverride,
        signal!,
      );
      context.history.push({
        step: step.step_number,
        command: step.action,
        output: result.output,
      });
      step.status = "done";
      step.result = result.output;
    } else if (step.agent === "general") {
      const result = await executeGeneralStep(
        step,
        messages,
        context,
        event,
        apiKey,
        config,
        signal,
      );

      step.status = "done";
      step.result = result.output;
      finalOutput = result.output;
    }

    // Persist step completion
    if (step.status === "done") {
      try {
        dbService.markPlanStepDone(sessionId, planHash, step.step_number);
      } catch {}
    }

    // Re-send updated plan with current statuses
    event.sender.send("stream-chunk", {
      chunk: JSON.stringify(
        steps.map((s) => ({
          step_number: s.step_number,
          tool_name: s.agent === "terminal" ? "terminal_tool" : "general_tool",
          description: s.action,
          status: s.status === "pending" ? "todo" : s.status,
        })),
        null,
        2,
      ),
      type: "plan",
      sessionId,
    });
  }

  context.done = true;
  LOG(TAG).INFO("Orchestration complete");

  return { text: finalOutput };
}
