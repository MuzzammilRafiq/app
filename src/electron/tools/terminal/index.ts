import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, stepCountIs, tool } from "ai";
import { LOG } from "../../utils/logging.js";
import * as z from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { IpcMainInvokeEvent, ipcMain } from "electron";
import { ChatRole, ChatType } from "../../../common/types.js";
let currentCwd = process.cwd();
const TAG = "terminal-agent";

// Pending confirmation requests mapped by requestId
const pendingConfirmations = new Map<string,{ resolve: (allowed: boolean) => void; reject: (reason: Error) => void }>();

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
export function cancelAllPendingConfirmations() {
  for (const [requestId, pending] of pendingConfirmations) {
    pending.reject(new DOMException("Aborted", "AbortError"));
    pendingConfirmations.delete(requestId);
  }
}
async function waitForUserConfirmation(
  event: IpcMainInvokeEvent,
  command: string,
  cwd: string,
  signal?: AbortSignal,
): Promise<boolean> {
  // If already aborted, return false immediately
  if (signal?.aborted) {
    return false;
  }

  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    // Handle abort signal
    const abortHandler = () => {
      if (pendingConfirmations.has(requestId)) {
        pendingConfirmations.delete(requestId);
        reject(new DOMException("Aborted", "AbortError"));
      }
    };

    if (signal) {
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    pendingConfirmations.set(requestId, {
      resolve: (allowed: boolean) => {
        signal?.removeEventListener("abort", abortHandler);
        resolve(allowed);
      },
      reject: (reason: Error) => {
        signal?.removeEventListener("abort", abortHandler);
        reject(reason);
      },
    });

    event.sender.send("terminal:request-confirmation", {
      command,
      requestId,
      cwd,
    });

    // Timeout after 5 minutes - auto-deny if no response
    setTimeout(() => {
      if (pendingConfirmations.has(requestId)) {
        pendingConfirmations.delete(requestId);
        signal?.removeEventListener("abort", abortHandler);
        resolve(false);
      }
    }, 300000);
  });
}

const SYSTEM_PROMPT = `You are a helpful terminal assistant running on macOS.

When the user asks you to perform tasks, use the executeCommand tool to run terminal commands.

IMPORTANT GUIDELINES:
- ALWAYS explain what you're about to do BEFORE calling a tool
- Use non-interactive, macOS-compatible commands
- For file operations, verify paths exist first
- Execute commands one at a time for safety
- After a command runs, analyze the output and continue with next steps if needed
- Keep going until the user's task is FULLY COMPLETE
- When done, provide a clear summary of what was accomplished

Each command requires user confirmation before execution.So dont worry about safety checks.
current working directory is ${currentCwd}`;

const execAsync = promisify(exec);
async function executeCommand(
  command: string,
  CONFIG: any,
  cwd: string = currentCwd,
): Promise<{ output: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: CONFIG.commandTimeout,
      maxBuffer: CONFIG.maxOutputBuffer,
      cwd,
    });

    let output = "";
    if (stdout) output += stdout;
    if (stderr) output += (output ? "\n" : "") + stderr;

    return {
      output: output || "Command executed successfully with no output",
      success: true,
    };
  } catch (error: any) {
    return {
      output: error.message || "Command failed",
      success: false,
    };
  }
}

async function confirmCommand(
  event: any,
  command: string,
  reason?: string,
): Promise<boolean> {
  if (reason) {
    event?.sender?.send("stream-chunk", {
      chunk: `REQUIRES CONFIRMATION: ${reason}\n`,
      type: "log",
    });
  }
  try {
    return await waitForUserConfirmation(event, command, currentCwd);
  } catch {
    return false;
  }
}

const executeCommandTool = (CONFIG: any, event: any) => {
  return tool({
    description:
      "Execute a terminal command. The command will be shown to the user for confirmation before execution. ",
    inputSchema: z.object({
      command: z.string().describe("The terminal command to execute"),
      reason: z
        .string()
        .optional()
        .describe("Brief explanation of why this command is needed"),
    }),
    execute: async ({ command, reason }) => {
      if (reason) {
        event.sender.send("stream-chunk", {
          chunk: `REASON: ${reason}\n`,
          type: "log",
        });
        LOG(TAG).INFO("Reason for command:", reason);
      }


      const confirmed = await confirmCommand(
        event,
        command,
        "Command confirmation",
      );
      if (!confirmed) {
        event.sender.send("stream-chunk", {
          chunk: `Command rejected by user\n`,
          type: "log",
        });
        LOG(TAG).INFO("Command rejected by user");
        return {
          executed: false,
          output:
            "User rejected the command. Please try a different approach or ask the user for guidance.",
          success: false,
        };
      }

      event.sender.send("stream-chunk", {
        chunk: `Executing command: ${command}\n`,
        type: "log",
      });
      LOG(TAG).INFO("Executing command:", command);
      const result = await executeCommand(command, CONFIG);
      event.sender.send("stream-chunk", {
        chunk: `${result.output}\n`,
        type: "log",
      });
      LOG(TAG).INFO("Command output:", result.output);
      return {
        executed: true,
        output: result.output,
        success: result.success,
      };
    },
  });
};

export const terminalAgent = async (
  initialContext: string,
  event: any,
  apiKey: string,
  maxIterations: number = 20,
  modelOverride: string,
  signal: AbortSignal,
): Promise<{ output: string }> => {
  LOG(TAG).INFO("terminal agent started with context::", initialContext);

  const CONFIG = {
    model: modelOverride || "moonshotai/kimi-k2-0905",
    maxSteps: maxIterations,
    commandTimeout: 30000,
    maxOutputBuffer: 5 * 1024,
  };
  const openrouter = createOpenRouter({ apiKey: apiKey });
  let stepCount = 0;
  let currentStepHasText = false;
  let hasReasoning = false;
  let summaryText = "";

  const result = streamText({
    model: openrouter(CONFIG.model),
    system: SYSTEM_PROMPT,
    prompt: `${initialContext}`,
    tools: {
      executeCommand: executeCommandTool(CONFIG, event),
    },
    stopWhen: stepCountIs(CONFIG.maxSteps),
    onStepFinish: ({ text, toolCalls, finishReason }) => {
      // Log step completion info
      summaryText = text
      if (toolCalls && toolCalls.length > 0) {
        event.sender.send("stream-chunk", {
          chunk: `Tool executed\n`,
          type: "log",
        });
        LOG(TAG).INFO(`Tool executed`);
      }
    },
    abortSignal: signal
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "start-step": {
        stepCount++;
        if (stepCount > 1) {
          event.sender.send("stream-chunk", {
            chunk: `\n--- Starting step ${stepCount} ---\n`,
            type: "log",
          });
        }
        currentStepHasText = false;
        hasReasoning = false;
        break;
      }

      case "reasoning-start": {
        event.sender.send("stream-chunk", {
          chunk: `\n💭 Thinking...\n`,
          type: "log",
        });
        hasReasoning = true;
        break;
      }

      case "reasoning-delta": {
        const reasoningContent =
          (part as any).text || (part as any).textDelta || "";
        event.sender.send("stream-chunk", {
          chunk: reasoningContent,
          type: "log",
        });
        break;
      }

      case "reasoning-end": {
        if (hasReasoning) {
          event.sender.send("stream-chunk", {
            chunk: `\n`,
            type: "log",
          });
        }

        break;
      }

      case "text-start": {
        event.sender.send("stream-chunk", {
          chunk: `\n🤖 Assistant: `,
          type: "log",
        });
        break;
      }

      case "text-delta": {
        const textContent = (part as any).text || (part as any).textDelta || "";
        event.sender.send("stream-chunk", {
          chunk: textContent,
          type: "stream" satisfies ChatType,
          role:"execution" satisfies ChatRole
        });
        currentStepHasText = true;
        summaryText += textContent;
        break;
      }

      case "text-end": {
        event.sender.send("stream-chunk", {
          chunk: `\n`,
          type: "log",
        });
        break;
      }

      case "tool-call": {
        if (hasReasoning || currentStepHasText) {
          event.sender.send("stream-chunk", {
            chunk: `\n`,
            type: "log",
          });
        }
        LOG(TAG).ERROR("Tool call:", part.input);
        break;
      }

      case "tool-result": {
        break;
      }

      case "finish-step": {
        break;
      }

      case "finish": {
        break;
      }

      case "error": {
        event.sender.send("stream-chunk", {
          chunk: `\nError: ${(part as any).error}\n`,
          type: "log",
        });
        LOG(TAG).ERROR("Stream error:", (part as any).error);
        break;
      }
    }
  }
  await result;
  if (stepCount > 0) {
        event.sender.send("stream-chunk", {
            chunk: `\nCompleted in ${stepCount} step(s)\n`,
            type: "log",
        });
        LOG(TAG).SUCCESS(`Completed in ${stepCount} step(s)`);
  } else {
        event.sender.send("stream-chunk", {
            chunk: `\nNo steps were executed.\n`,
            type: "log",
        });
        LOG(TAG).WARN(`No steps were executed.`);
  }

    return {
      output:
        summaryText.trim() || "Terminal agent execution completed.",
    };
};
