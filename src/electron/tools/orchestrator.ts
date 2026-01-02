import { ASK_TEXT, type ChatMessage } from "../services/model.js";
import dbService from "../services/database.js";
import { LOG } from "../utils/logging.js";
import {
  ChatMessageRecord,
  OrchestratorStep,
  OrchestratorContext,
} from "../../common/types.js";
import { IpcMainInvokeEvent, ipcMain } from "electron";
import { terminalExecutor, checkCommandSecurity } from "./terminal/index.js";
import { generalTool } from "./general/index.js";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const TAG = "orchestrator";

// Truncate large outputs to prevent context bloat
const MAX_OUTPUT_LENGTH = 2000;
function truncateOutput(
  output: string,
  maxLen: number = MAX_OUTPUT_LENGTH
): string {
  if (!output || output.length <= maxLen) return output;
  const half = Math.floor(maxLen / 2);
  return (
    output.slice(0, half) +
    "\n\n... [truncated " +
    (output.length - maxLen) +
    " chars] ...\n\n" +
    output.slice(-half)
  );
}

// Pending confirmation requests mapped by requestId
const pendingConfirmations = new Map<
  string,
  { resolve: (allowed: boolean) => void }
>();

// IPC handler for confirmation responses from renderer
ipcMain.handle(
  "terminal:confirmation-response",
  (_event, requestId: string, allowed: boolean) => {
    const pending = pendingConfirmations.get(requestId);
    if (pending) {
      pending.resolve(allowed);
      pendingConfirmations.delete(requestId);
    }
  }
);

// Wait for user confirmation before executing a command
async function waitForUserConfirmation(
  event: IpcMainInvokeEvent,
  command: string,
  cwd: string
): Promise<boolean> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    pendingConfirmations.set(requestId, { resolve });
    event.sender.send("terminal:request-confirmation", {
      command,
      requestId,
      cwd,
    });

    // Timeout after 5 minutes - auto-deny if no response
    setTimeout(() => {
      if (pendingConfirmations.has(requestId)) {
        pendingConfirmations.delete(requestId);
        resolve(false);
      }
    }, 300000);
  });
}

const SYSTEM_PROMPT_PLANNER = `
You are a task orchestrator for a macOS system. Your job is to break down user requests into granular, executable steps.

Available Agents:
1. terminal - Executes shell commands on macOS. You can use any standard shell commands including pipes and chaining.
2. general - Provides natural language responses, summaries, and formatted output to the user

Rules:
- Output JSON only, matching the schema strictly
- Create granular steps - prefer simpler commands but can use pipes when needed
- Maximum 15 steps per plan
- Always end with a "general" step to format the final response for the user
- If the request is a simple question or greeting, use only a "general" step
- For file operations, verify paths exist before acting (use ls first)
- Consider the conversation history for context
- The user will be asked to confirm each terminal command before execution

Step Format:
- agent: "terminal" or "general"
- action: For terminal, the exact command. For general, describe what to respond about.

Examples:

User: "What time is it?"
{
  "steps": [
    {"step_number": 1, "agent": "terminal", "action": "date"},
    {"step_number": 2, "agent": "general", "action": "Format the current date/time for the user"}
  ]
}

User: "Count folders in Downloads"
{
  "steps": [
    {"step_number": 1, "agent": "terminal", "action": "find ~/Downloads -maxdepth 1 -type d | wc -l"},
    {"step_number": 2, "agent": "general", "action": "Report the folder count to the user"}
  ]
}

User: "Hello!"
{
  "steps": [
    {"step_number": 1, "agent": "general", "action": "Greet the user warmly"}
  ]
}
`;

/**
 * Generate a granular execution plan from user messages
 */
async function generatePlan(
  messages: ChatMessageRecord[],
  apiKey: string,
  event: IpcMainInvokeEvent,
  config: any
): Promise<{ steps: OrchestratorStep[]; error?: string }> {
  try {
    const chatHistory: ChatMessage[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const M: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT_PLANNER },
      ...chatHistory,
    ];

    const options = {
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "orchestrator_plan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              steps: {
                type: "array",
                minItems: 1,
                maxItems: 15,
                items: {
                  type: "object",
                  properties: {
                    step_number: {
                      type: "number",
                      description: "Sequential step number starting from 1",
                    },
                    agent: {
                      type: "string",
                      enum: ["terminal", "general"],
                      description: "The agent to execute this step",
                    },
                    action: {
                      type: "string",
                      description:
                        "For terminal: exact command. For general: task description",
                    },
                  },
                  required: ["step_number", "agent", "action"],
                  additionalProperties: false,
                },
              },
            },
            required: ["steps"],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.2,
      overrideModel: config?.textModelOverride,
    };

    const response = ASK_TEXT(apiKey, M, options);
    if (!response) {
      throw new Error("No response from LLM");
    }

    let content = "";
    for await (const { content: chunk, reasoning } of response) {
      if (chunk) content += chunk;
      if (reasoning) {
        event.sender.send("stream-chunk", { chunk: reasoning, type: "log" });
      }
    }

    const parsed = JSON.parse(content);
    const steps: OrchestratorStep[] = parsed.steps.map(
      (s: {
        step_number: number;
        agent: "terminal" | "general";
        action: string;
      }) => ({
        step_number: s.step_number,
        agent: s.agent,
        action: s.action,
        status: "pending" as const,
      })
    );

    LOG(TAG).INFO(`Generated plan with ${steps.length} steps`);
    return { steps };
  } catch (error) {
    LOG(TAG).ERROR("Failed to generate plan:", error);
    return {
      steps: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Execute a single terminal step
 */
async function executeTerminalStep(
  step: OrchestratorStep,
  context: OrchestratorContext,
  event: IpcMainInvokeEvent
): Promise<{ output: string; success: boolean; newCwd?: string }> {
  const command = step.action.trim();

  // Handle cd commands specially - update cwd
  if (command.startsWith("cd ")) {
    const target = command.slice(3).trim();
    const home = os.homedir();
    const expanded = target.startsWith("~")
      ? path.join(home, target.slice(1))
      : target;
    const newCwd = path.isAbsolute(expanded)
      ? expanded
      : path.resolve(context.cwd, expanded);

    event.sender.send("stream-chunk", {
      chunk: `Changed directory to: ${newCwd}\n`,
      type: "log",
    });

    return { output: `Changed to ${newCwd}`, success: true, newCwd };
  }

  // Check if command is potentially dangerous (for user awareness)
  const security = checkCommandSecurity(command);
  if (security.needConformation) {
    event.sender.send("stream-chunk", {
      chunk: `⚠️ Warning: ${security.reason}\n`,
      type: "log",
    });
  }

  // Request user confirmation before executing
  LOG(TAG).INFO(`Requesting confirmation for: ${command}`);
  const allowed = await waitForUserConfirmation(event, command, context.cwd);

  if (!allowed) {
    event.sender.send("stream-chunk", {
      chunk: `❌ Command denied by user: ${command}\n`,
      type: "log",
    });
    return { output: "Command denied by user", success: false };
  }

  // Execute the command
  event.sender.send("stream-chunk", {
    chunk: `✓ Command approved, executing...\n`,
    type: "log",
  });

  const result = await terminalExecutor(command, context.cwd);

  // Truncate large outputs to prevent context/UI bloat
  const truncatedOutput = truncateOutput(result.output);

  event.sender.send("stream-chunk", {
    chunk: `$ ${command}\n${truncatedOutput}\n`,
    type: "log",
  });

  return { output: truncatedOutput, success: result.success };
}

/**
 * Execute a general agent step (final response formatting)
 */
async function executeGeneralStep(
  step: OrchestratorStep,
  messages: ChatMessageRecord[],
  context: OrchestratorContext,
  event: IpcMainInvokeEvent,
  apiKey: string,
  config: any,
  signal?: AbortSignal
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
    signal
  );
}

/**
 * Main orchestrator function - generates plan and executes steps sequentially
 */
export async function orchestrate(
  messages: ChatMessageRecord[],
  event: IpcMainInvokeEvent,
  apiKey: string,
  sessionId: string,
  config: any,
  signal?: AbortSignal
): Promise<{ text: string; error?: string }> {
  LOG(TAG).INFO("Starting orchestration");

  // Generate the plan
  // Note: generatePlan could also take signal if we want to cancel plan generation
  // For now, we mainly care about cancelling execution and heavy generation
  const planResult = await generatePlan(messages, apiKey, event, config);

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
        2
      ),
      type: "plan",
    });

    event.sender.send("stream-chunk", {
      chunk: `\n📍 Step ${step.step_number}: [${step.agent}] ${step.action}\n`,
      type: "log",
    });

    if (step.agent === "terminal") {
      const result = await executeTerminalStep(step, context, event);

      if (result.newCwd) {
        context.cwd = result.newCwd;
      }

      context.history.push({
        step: step.step_number,
        command: step.action,
        output: result.output,
      });

      step.status = result.success ? "done" : "failed";
      step.result = result.output;
    } else if (step.agent === "general") {
      const result = await executeGeneralStep(
        step,
        messages,
        context,
        event,
        apiKey,
        config,
        signal
      );

      step.status = "done";
      step.result = result.output;
      finalOutput = result.output;
    }

    // Emit step completion
    event.sender.send("stream-chunk", {
      chunk: `✓ Step ${step.step_number} completed\n`,
      type: "log",
    });

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
        2
      ),
      type: "plan",
    });
  }

  context.done = true;
  LOG(TAG).INFO("Orchestration complete");

  return { text: finalOutput };
}
