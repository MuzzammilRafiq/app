import { ASK_TEXT, type ChatMessage } from "../services/model.js";
import dbService from "../services/database.js";
import { LOG } from "../utils/logging.js";
import {
  ChatMessageRecord,
  OrchestratorStep,
  OrchestratorContext,
} from "../../common/types.js";
import { IpcMainInvokeEvent, ipcMain } from "electron";
import { adaptiveTerminalExecutor } from "./terminal/index.js";
import { generalTool } from "./general/index.js";
import { StreamChunkBuffer } from "../utils/stream-buffer.js";
import os from "node:os";
import crypto from "node:crypto";

const TAG = "orchestrator";

// Truncate large outputs to prevent context bloat
const MAX_OUTPUT_LENGTH = 2000;
function truncateOutput(
  output: string,
  maxLen: number = MAX_OUTPUT_LENGTH,
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
  },
);

// Wait for user confirmation before executing a command
async function waitForUserConfirmation(
  event: IpcMainInvokeEvent,
  command: string,
  cwd: string,
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
`;

/**
 * Generate a granular execution plan from user messages
 */
async function generatePlan(
  messages: ChatMessageRecord[],
  apiKey: string,
  event: IpcMainInvokeEvent,
  config: any,
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
                maxItems: 5,
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
                        "For terminal: goal to achieve. For general: task description",
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

    const buffer = new StreamChunkBuffer(event.sender);
    let content = "";
    for await (const { content: chunk, reasoning } of response) {
      if (chunk) content += chunk;
      if (reasoning) {
        buffer.send(reasoning, "log");
      }
    }
    buffer.flush();

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
      }),
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
 * Execute a terminal step using the adaptive executor.
 * The adaptive executor loops internally to achieve the goal,
 * requesting user confirmation for each command.
 */
async function executeTerminalStep(
  step: OrchestratorStep,
  context: OrchestratorContext,
  event: IpcMainInvokeEvent,
  apiKey: string,
  config: any,
): Promise<{ output: string; success: boolean; newCwd?: string }> {
  const goal = step.action.trim();

  event.sender.send("stream-chunk", {
    chunk: `🎯 Goal: ${goal}\n`,
    type: "log",
  });

  // Use adaptive executor with loop-based goal completion
  const result = await adaptiveTerminalExecutor(
    goal,
    context.cwd,
    event,
    apiKey,
    {
      maxIterations: 10,
      maxConsecutiveErrors: 2,
    },
    // Confirmation callback - requests user approval for each command
    (command: string, cwd: string) =>
      waitForUserConfirmation(event, command, cwd),
  );

  if (!result.success) {
    event.sender.send("stream-chunk", {
      chunk: `❌ Goal failed: ${result.failureReason}\n`,
      type: "log",
    });
  } else {
    event.sender.send("stream-chunk", {
      chunk: `✅ Goal achieved in ${result.iterations} iteration(s)\n`,
      type: "log",
    });
  }

  return {
    output: result.output,
    success: result.success,
    newCwd: result.finalCwd !== context.cwd ? result.finalCwd : undefined,
  };
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

/**
 * Main orchestrator function - generates plan and executes steps sequentially
 */
export async function orchestrate(
  messages: ChatMessageRecord[],
  event: IpcMainInvokeEvent,
  apiKey: string,
  sessionId: string,
  config: any,
  signal?: AbortSignal,
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
        2,
      ),
      type: "plan",
    });

    event.sender.send("stream-chunk", {
      chunk: `\n📍 Step ${step.step_number}: [${step.agent}] ${step.action}\n`,
      type: "log",
    });

    if (step.agent === "terminal") {
      const result = await executeTerminalStep(
        step,
        context,
        event,
        apiKey,
        config,
      );

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

      // Stop the entire plan if a terminal step fails
      if (!result.success) {
        LOG(TAG).ERROR(
          `Step ${step.step_number} failed, aborting remaining steps`,
        );

        // Mark remaining steps as failed/cancelled
        for (let j = i + 1; j < steps.length; j++) {
          steps[j].status = "failed";
        }

        // Send updated plan status
        event.sender.send("stream-chunk", {
          chunk: JSON.stringify(
            steps.map((s) => ({
              step_number: s.step_number,
              tool_name:
                s.agent === "terminal" ? "terminal_tool" : "general_tool",
              description: s.action,
              status: s.status === "pending" ? "todo" : s.status,
            })),
            null,
            2,
          ),
          type: "plan",
        });

        return {
          text: "",
          error: `Step ${step.step_number} failed: ${result.output}`,
        };
      }
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
        2,
      ),
      type: "plan",
    });
  }

  context.done = true;
  LOG(TAG).INFO("Orchestration complete");

  return { text: finalOutput };
}
