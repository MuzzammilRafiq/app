import { exec } from "child_process";
import { promisify } from "util";
import { ASK_TEXT, type ChatMessage } from "../../services/model.js";
import { LOG } from "../../utils/logging.js";
import { StreamChunkBuffer } from "../../utils/stream-buffer.js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import type {
  AdaptiveExecutorConfig,
  AdaptiveExecutorResult,
  AdaptiveExecutorCommand,
} from "../../../common/types.js";
const TAG = "terminal";
const execAsync = promisify(exec);

// File size threshold for cat command optimization (50KB)
const CAT_FILE_SIZE_THRESHOLD = 50 * 1024;
// Line count threshold for cat command optimization
const CAT_LINE_COUNT_THRESHOLD = 100;

// Security: List of dangerous commands that should be blocked
const DANGEROUS_COMMANDS = [
  "sudo",
  "su",
  "chmod +x",
  "curl",
  "wget",
  "ssh",
  "scp",
  "ftp",
  "sftp",
  "dd",
  "mkfs",
  "fdisk",
  "format",
  "diskpart",
  "shutdown",
  "reboot",
  "halt",
  "kill -9",
  "killall",
  "pkill",
  "systemctl",
  "service",
  "launchctl",
  "crontab",
  "nohup",
  "&",
  "node -e",
  "eval",
  "exec",
  "bash -c",
  "sh -c",
  "zsh -c",
  "perl -e",
  "ruby -e",
  "php -r",
  "rm -rf",
  "rm -r",
  "diskutil",
  "brew uninstall",
  "find -delete",
  "sed -i",
  "truncate",
];

// Security: Commands that can modify system files or settings
const SYSTEM_MODIFY_PATTERNS = [
  /\/etc\//,
  /\/usr\//,
  /\/bin\//,
  /\/sbin\//,
  /\/lib\//,
  /\/var\/log\//,
  /\/System\//,
  /\/Applications\//,
  /\/Library\//,
  /\/Windows\//,
  /\/Program Files/,
  /chmod/,
  /chown/,
  /chgrp/,
  />.*\/etc\//,
  />.*\/usr\//,
  />.*\/bin\//,
  /rm\s+-rf/,
  /rm\s+-r/,
  /diskutil/,
  /find\s+.*-delete/,
  /sed\s+-i/,
  /truncate/,
];
// Note: We use a blocklist approach for warnings only
// User confirmation handles security, so most commands are allowed

/**
 * Optimizes cat commands for large files by converting them to head + tail.
 * This prevents memory issues and timeouts when trying to cat very large files.
 * @param command The command to optimize
 * @param cwd The current working directory for resolving relative paths
 * @returns The optimized command and a message if transformation occurred
 */
export const optimizeCatCommand = (
  command: string,
  cwd?: string,
): { command: string; message?: string } => {
  const trimmed = command.trim();

  // Match simple cat commands: cat <file>, cat file, cat ./file, cat /path/to/file
  // Don't match: cat file1 file2 (multiple files), cat | other (pipes), cat > file (redirects)
  const catMatch = trimmed.match(/^cat\s+([^\s|>&<]+)$/);

  if (!catMatch) {
    return { command };
  }

  const filePath = catMatch[1];

  // Resolve the full path
  let fullPath: string;
  try {
    if (path.isAbsolute(filePath)) {
      fullPath = filePath;
    } else if (filePath.startsWith("~")) {
      fullPath = path.join(os.homedir(), filePath.slice(1));
    } else {
      fullPath = path.resolve(cwd || process.cwd(), filePath);
    }

    // Check if file exists and get its size
    const stats = fs.statSync(fullPath);

    if (!stats.isFile()) {
      return { command };
    }

    // Check file size
    const fileTooLarge = stats.size > CAT_FILE_SIZE_THRESHOLD;

    // Also check line count
    let lineCount = 0;
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      lineCount = content.split("\n").length;
    } catch (error) {
      // If we can't read the file to count lines, just skip the line count check
      lineCount = 0;
    }
    const tooManyLines = lineCount > CAT_LINE_COUNT_THRESHOLD;

    // If file is larger than threshold OR has too many lines, transform the command
    if (fileTooLarge || tooManyLines) {
      const sizeInKB = Math.round(stats.size / 1024);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      const reason = fileTooLarge ? `${sizeInKB}KB` : `${lineCount} lines`;
      const optimizedCommand = `(echo "=== File: ${filePath} (${sizeInMB}MB, ${lineCount} lines) - Showing first and last 50 lines ===" && echo && head -n 50 ${filePath} && echo && echo "... [middle section truncated] ..." && echo && tail -n 50 ${filePath})`;

      return {
        command: optimizedCommand,
        message: `Large file detected (${reason}). Showing head and tail instead of entire file.`,
      };
    }
  } catch (error) {
    // If file doesn't exist or we can't stat it, just return original command
    // The actual execution will handle the error
    return { command };
  }

  return { command };
};

const SYSTEM_PROMPT = `
You are a macOS terminal agent. Output only a single JSON object with keys: updated_context, command. No extra text.
- Non-interactive, macOS-compatible, idempotent commands
- Avoid destructive operations and system modifications
- Prefer absolute or verified relative paths
- Verify with ls/pwd before acting
- Use "DONE" when the goal is achieved
- Minimal steps: never run exploratory commands once the requested result is obtained
- Decide using context: if last output satisfies the users goal, set command to "DONE"
- For single-output goals like "show", "print", "get", use exactly one command then "DONE"
- updated_context must preserve the specific STDOUT needed to satisfy the users goal
- You can use pipes, command chaining, and any standard shell features as needed
- Avoid commands that require user interaction or run indefinitely
`;
export const checkCommandSecurity = (
  command: string,
): { needConformation: boolean; reason: string } => {
  const normalizedCommand = command.toLowerCase().trim();

  // Check for dangerous commands
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (normalizedCommand.includes(dangerous.toLowerCase())) {
      return {
        needConformation: true,
        reason: `Command contains potentially dangerous operation: ${dangerous}`,
      };
    }
  }

  // Check for system file modification patterns
  for (const pattern of SYSTEM_MODIFY_PATTERNS) {
    if (pattern.test(command)) {
      return {
        needConformation: true,
        reason: "Command attempts to modify system files or directories",
      };
    }
  }

  return {
    needConformation: false,
    reason: "Command is safe",
  };
};

export const terminalTool = async (
  event: any,
  command: string,
  confirm = false,
  cwd?: string,
): Promise<{
  output: string;
  needConformation: boolean;
  reason: string;
  success: boolean;
}> => {
  try {
    // Optimize cat commands for large files
    const { command: optimizedCommand, message: optimizationMessage } =
      optimizeCatCommand(command, cwd);

    // Log if command was optimized
    if (optimizationMessage) {
      LOG(TAG).INFO(optimizationMessage);
      event?.sender?.send("stream-chunk", {
        chunk: `⚠️  ${optimizationMessage}\n`,
        type: "log",
      });
    }

    const { needConformation, reason } = checkCommandSecurity(optimizedCommand);

    if (needConformation && !confirm) {
      return { output: "", needConformation, reason, success: false };
    }

    const { stdout, stderr } = await execAsync(optimizedCommand, {
      timeout: 30000,
      maxBuffer: 1024 * 1024, // 1MB max output
      cwd,
    });

    let output = "";
    if (stdout) {
      output += `STDOUT:\n${stdout}`;
    }
    if (stderr) {
      output += output ? `\n\nSTDERR:\n${stderr}` : `STDERR:\n${stderr}`;
    }

    // Note: execAsync only throws on execution errors, not on command failures
    // The command is considered "successful" if it executed without throwing
    // stderr presence doesn't indicate failure - many commands use it for warnings/info
    // For more accurate success detection, we'd need to use spawn or check exit codes differently

    return {
      output: output || "Command executed successfully with no output",
      needConformation: false,
      reason: stderr
        ? "Command executed with warnings/info messages"
        : "Command executed successfully",
      success: true,
    };
  } catch (error: any) {
    LOG(TAG).ERROR("Terminal execution failed:", error.message);
    return {
      output: "",
      needConformation: false,
      reason: error.message,
      success: false,
    };
  }
};

/**
 * Simplified terminal executor for the orchestrator.
 * Executes a single command and returns the result.
 * Does NOT include LLM planning - the orchestrator handles that.
 */
export const terminalExecutor = async (
  command: string,
  cwd?: string,
): Promise<{ output: string; success: boolean }> => {
  try {
    // Optimize cat commands for large files
    const { command: optimizedCommand, message: optimizationMessage } =
      optimizeCatCommand(command, cwd);

    if (optimizationMessage) {
      LOG(TAG).INFO(optimizationMessage);
    }

    LOG(TAG).INFO(`Executing: ${optimizedCommand} @ ${cwd || process.cwd()}`);

    const { stdout, stderr } = await execAsync(optimizedCommand, {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      cwd: cwd || process.cwd(),
    });

    let output = "";
    if (stdout) output += stdout;
    if (stderr) output += (output ? "\n" : "") + stderr;

    return {
      output: output || "Command executed successfully with no output",
      success: true,
    };
  } catch (error: any) {
    LOG(TAG).ERROR("Terminal execution failed:", error.message);
    return {
      output: error.message || "Command failed",
      success: false,
    };
  }
};

// System prompt for the adaptive terminal executor
const ADAPTIVE_SYSTEM_PROMPT = `
You are a macOS terminal agent working to achieve a specific goal. Output only a single JSON object with keys: updated_context, command. No extra text.

Guidelines:
- Execute non-interactive, macOS-compatible, idempotent commands
- Avoid destructive operations unless explicitly required by the goal
- Prefer absolute or verified relative paths
- ALWAYS verify before acting: use ls/pwd to check if files/directories exist before operations
- Use "DONE" when the goal is fully achieved and verified
- If something doesn't exist that you need, create it (mkdir -p, touch, etc.)
- If an error occurs, try to recover or find an alternative approach
- Minimal steps: don't run exploratory commands once the goal is achieved
- updated_context must preserve important information needed for the final summary
- You can use pipes, command chaining, and any standard shell features
- Avoid commands that require user interaction or run indefinitely

Error Recovery:
- If a directory doesn't exist, create it with mkdir -p
- If a file doesn't exist and you need to move/copy to it, check if you have the right path
- If permissions fail, note the error and set command to "DONE" with failure explanation
- Never repeat the exact same command that just failed
`;

/**
 * Adaptive terminal executor with loop-based goal completion.
 * Takes a goal description and loops until the goal is achieved or fails.
 * User confirmation is requested for each command via the confirmCommand callback.
 */
export const adaptiveTerminalExecutor = async (
  goal: string,
  initialCwd: string,
  event: any,
  apiKey: string,
  config: AdaptiveExecutorConfig,
  confirmCommand: (command: string, cwd: string) => Promise<boolean>,
  signal?: AbortSignal,
): Promise<AdaptiveExecutorResult> => {
  LOG(TAG).INFO(`Adaptive executor started with goal: ${goal}`);

  // Check if already cancelled
  if (signal?.aborted) {
    return {
      success: false,
      output: "Cancelled by user",
      iterations: 0,
      commands: [],
      finalCwd: initialCwd,
      failureReason: "Cancelled by user",
    };
  }

  const home = os.homedir();
  let currentCwd = initialCwd;
  let lastCommand = "";
  let lastOutputSnippet = "";
  let consecutiveErrors = 0;
  const commands: AdaptiveExecutorCommand[] = [];

  // Build initial context with goal
  let currentContext = `GOAL: ${goal}\n\nCWD: ${currentCwd}\n\nBegin by checking the current state, then work towards achieving the goal.`;

  // Helper to resolve paths with ~ expansion
  const resolveCwd = (base: string, p: string) => {
    const expanded = p.startsWith("~") ? path.join(home, p.slice(1)) : p;
    return path.isAbsolute(expanded) ? expanded : path.resolve(base, expanded);
  };

  // Helper to handle cd commands and return remaining command
  const applyCd = (cmd: string): string => {
    const trimmed = cmd.trim();
    if (trimmed.startsWith("cd ")) {
      const rest = trimmed.slice(3).trim();
      const parts = rest.split(/\s*(?:&&|;)\s*/);
      const target = parts[0];
      currentCwd = resolveCwd(currentCwd, target);
      const remaining = parts.slice(1).join(" && ").trim();
      return remaining || "pwd";
    }
    const match = trimmed.match(/^cd\s+([^\s]+)\s+&&\s+(.+)$/);
    if (match) {
      currentCwd = resolveCwd(currentCwd, match[1]);
      return match[2].trim();
    }
    return cmd;
  };

  // Helper to truncate output
  const trimOutput = (s: string, limit = 2000) => {
    if (!s) return "";
    if (s.length <= limit) return s;
    const half = Math.floor(limit / 2);
    return s.slice(0, half) + "\n...[truncated]...\n" + s.slice(-half);
  };

  // Main execution loop
  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    // Check for cancellation at start of each iteration
    if (signal?.aborted) {
      LOG(TAG).INFO("Adaptive executor cancelled by user");
      event.sender.send("stream-chunk", {
        chunk: `  ❌ Cancelled by user\n`,
        type: "log",
      });
      return {
        success: false,
        output: currentContext,
        iterations: iteration,
        commands,
        finalCwd: currentCwd,
        failureReason: "Cancelled by user",
      };
    }

    event.sender.send("stream-chunk", {
      chunk: `  └─ Iteration ${iteration}: Analyzing next action...\n`,
      type: "log",
    });

    // Ask LLM for next command
    const M: ChatMessage[] = [
      { role: "system", content: ADAPTIVE_SYSTEM_PROMPT },
      { role: "user", content: currentContext },
    ];

    const options = {
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "terminal_agent_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              updated_context: {
                type: "string",
                description:
                  "Updated context with progress info and relevant output for next steps or final summary",
              },
              command: {
                type: "string",
                description:
                  "Next terminal command to execute, or 'DONE' if goal is achieved",
              },
            },
            required: ["updated_context", "command"],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.2,
      signal,
    };

    let parsed: { updated_context: string; command: string } | null = null;
    let tries = 0;

    while (!parsed && tries < 2) {
      try {
        const response = ASK_TEXT(apiKey, M, options);
        if (!response) {
          throw new Error("No response from LLM");
        }

        const buffer = new StreamChunkBuffer(event.sender);
        let content = "";
        for await (const { content: chunk, reasoning } of response) {
          if (chunk) content += chunk;
          if (reasoning) buffer.send(reasoning, "log");
        }
        buffer.flush();

        // Clean and parse response
        const cleaned = content
          .replace(/\p{Cc}/gu, (char) => {
            const map: { [key: string]: string } = {
              "\n": "\\n",
              "\r": "\\r",
              "\t": "\\t",
            };
            return map[char] || "";
          })
          .trim();

        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const start = cleaned.indexOf("{");
          const end = cleaned.lastIndexOf("}");
          if (start >= 0 && end > start) {
            try {
              parsed = JSON.parse(cleaned.slice(start, end + 1));
            } catch {
              parsed = null;
            }
          }
        }
      } catch (error) {
        LOG(TAG).ERROR("LLM request failed:", error);
      }
      tries++;
    }

    if (!parsed) {
      LOG(TAG).ERROR("Failed to get valid LLM response");
      return {
        success: false,
        output: currentContext,
        iterations: iteration,
        commands,
        finalCwd: currentCwd,
        failureReason: "Failed to get valid response from LLM",
      };
    }

    // Check if goal is complete
    if (parsed.command.toUpperCase() === "DONE") {
      LOG(TAG).INFO("Goal achieved!");
      event.sender.send("stream-chunk", {
        chunk: `  ✓ Goal achieved\n`,
        type: "log",
      });
      return {
        success: true,
        output: parsed.updated_context,
        iterations: iteration,
        commands,
        finalCwd: currentCwd,
      };
    }

    // Validate command is not empty
    const commandToExecute = parsed.command.trim();
    if (!commandToExecute) {
      LOG(TAG).WARN("Empty command from LLM, skipping");
      currentContext = `${parsed.updated_context}\n\nError: Empty command received. Please provide a valid command.`;
      continue;
    }

    // Apply cd and get prepared command
    const prepared = applyCd(commandToExecute);

    event.sender.send("stream-chunk", {
      chunk: `     $ ${prepared}\n`,
      type: "log",
    });

    // Request user confirmation
    let allowed: boolean;
    try {
      allowed = await confirmCommand(prepared, currentCwd);
    } catch (error) {
      // Handle abort error from confirmCommand
      if (error instanceof DOMException && error.name === "AbortError") {
        LOG(TAG).INFO("Confirmation cancelled by user");
        event.sender.send("stream-chunk", {
          chunk: `     ❌ Cancelled by user\n`,
          type: "log",
        });
        return {
          success: false,
          output: currentContext,
          iterations: iteration,
          commands,
          finalCwd: currentCwd,
          failureReason: "Cancelled by user",
        };
      }
      throw error;
    }

    if (!allowed) {
      event.sender.send("stream-chunk", {
        chunk: `     ❌ Command denied by user\n`,
        type: "log",
      });
      return {
        success: false,
        output: currentContext,
        iterations: iteration,
        commands,
        finalCwd: currentCwd,
        failureReason: "Command denied by user",
      };
    }

    event.sender.send("stream-chunk", {
      chunk: `     ✓ Approved, executing...\n`,
      type: "log",
    });

    // Execute the command
    const result = await terminalExecutor(prepared, currentCwd);

    // Record command execution
    commands.push({
      command: prepared,
      output: result.output,
      success: result.success,
    });

    // Show output in logs
    const outputPreview = trimOutput(result.output, 500);
    if (outputPreview) {
      event.sender.send("stream-chunk", {
        chunk: `     ${outputPreview.split("\n").join("\n     ")}\n`,
        type: "log",
      });
    }

    // Update context with result
    const snippet = trimOutput(result.output);
    currentContext = `${parsed.updated_context}\n\nCWD: ${currentCwd}\nLast Command: ${prepared}\nOutput: ${snippet}`;

    if (!result.success) {
      consecutiveErrors++;
      currentContext += `\n\nCommand failed. Error count: ${consecutiveErrors}/${config.maxConsecutiveErrors}`;
      currentContext += `\nTry a different approach or set command to "DONE" with failure explanation if unrecoverable.`;

      event.sender.send("stream-chunk", {
        chunk: `     ⚠️ Command failed (${consecutiveErrors}/${config.maxConsecutiveErrors})\n`,
        type: "log",
      });

      if (consecutiveErrors >= config.maxConsecutiveErrors) {
        LOG(TAG).ERROR("Too many consecutive errors, aborting");
        return {
          success: false,
          output: currentContext,
          iterations: iteration,
          commands,
          finalCwd: currentCwd,
          failureReason: `Too many consecutive errors (${consecutiveErrors})`,
        };
      }
    } else {
      // Reset error count on success
      consecutiveErrors = 0;
    }

    // Stall detection
    const repeat = prepared === lastCommand && snippet === lastOutputSnippet;
    if (repeat) {
      LOG(TAG).WARN("Stall detected: repeated command/output");
      currentContext += `\n\nDETECTED STALL: Same command and output repeated. Try a different approach or set command to "DONE".`;
    }
    lastCommand = prepared;
    lastOutputSnippet = snippet;
  }

  // Max iterations reached
  LOG(TAG).WARN("Max iterations reached without completing goal");
  return {
    success: false,
    output: currentContext,
    iterations: config.maxIterations,
    commands,
    finalCwd: currentCwd,
    failureReason: `Reached maximum iterations (${config.maxIterations}) without completing goal`,
  };
};

// Terminal Agent Function
export const terminalStep = async (
  event: any,
  apiKey: string,
  context: string,
  index: number,
  signal?: AbortSignal,
): Promise<{
  updatedContext: string;
  command: string;
  success: boolean;
  error?: string;
}> => {
  try {
    LOG(TAG).INFO(`Terminal Agent Iteration ${index}`);
    const M: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: context },
    ];
    const options = {
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "terminal_agent_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              updated_context: {
                type: "string",
                description:
                  "Updated context string including progress and relevant information for next steps",
              },
              command: {
                type: "string",
                description:
                  "Next terminal command to execute, or 'DONE' if goal is achieved",
              },
            },
            required: ["updated_context", "command"],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.2,
      signal,
    };
    let parsed: { updated_context: string; command: string } | null = null;
    let tries = 0;
    while (!parsed && tries < 2) {
      const response = ASK_TEXT(apiKey, M, options);
      if (!response) {
        throw new Error("No response content received from LLM");
      }
      const buffer = new StreamChunkBuffer(event.sender);
      let c = "";
      for await (const { content, reasoning } of response) {
        if (content) {
          c += content;
        }
        if (reasoning) {
          buffer.send(reasoning, "log");
        }
      }
      buffer.flush();
      let cleaned = c
        .replace(/\p{Cc}/gu, (char) => {
          const map: { [key: string]: string } = {
            "\n": "\\n",
            "\r": "\\r",
            "\t": "\\t",
          };
          return map[char] || "";
        })
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start >= 0 && end > start) {
          const slice = cleaned.slice(start, end + 1);
          try {
            parsed = JSON.parse(slice);
          } catch {
            parsed = null;
          }
        }
      }
      tries++;
    }
    if (!parsed) {
      throw new Error("Failed to parse JSON response from LLM");
    }
    if (
      typeof parsed.updated_context !== "string" ||
      typeof parsed.command !== "string"
    ) {
      throw new Error("Invalid response schema from LLM");
    }

    LOG(TAG).INFO(parsed.command, parsed.updated_context);
    event.sender.send("stream-chunk", {
      chunk: `RAN COMMAND: "${parsed.command}"\n`,
      type: "log",
    });

    return {
      updatedContext: parsed.updated_context,
      command: parsed.command,
      success: true,
    };
  } catch (error: any) {
    LOG(TAG).ERROR("Terminal Agent Error:" + error.message);
    return {
      updatedContext: context,
      command: "DONE",
      success: false,
      error: error.message,
    };
  }
};

// Multi-step Terminal Agent Function
export const terminalAgent = async (
  initialContext: string,
  event: any,
  apiKey: string,
  maxIterations: number = 20,
): Promise<{ output: string }> => {
  LOG(TAG).INFO("terminal agent started with context::", initialContext);
  let currentContext = initialContext;
  let currentCwd = process.cwd();
  let lastCommand = "";
  let lastOutputSnippet = "";
  let blockedCount = 0;
  const executionLog: Array<{
    iteration: number;
    context: string;
    command: string;
    output: string;
    success: boolean;
  }> = [];

  const home = os.homedir();
  const resolveCwd = (base: string, p: string) => {
    const expanded = p.startsWith("~") ? path.join(home, p.slice(1)) : p;
    return path.isAbsolute(expanded) ? expanded : path.resolve(base, expanded);
  };
  const applyCd = (cmd: string) => {
    const trimmed = cmd.trim();
    if (trimmed.startsWith("cd ")) {
      const rest = trimmed.slice(3).trim();
      const parts = rest.split(/\s*(?:&&|;)\s*/);
      const target = parts[0];
      currentCwd = resolveCwd(currentCwd, target);
      const remaining = parts.slice(1).join(" && ").trim();
      return remaining || "pwd";
    }
    const match = trimmed.match(/^cd\s+([^\s]+)\s+&&\s+(.+)$/);
    if (match) {
      currentCwd = resolveCwd(currentCwd, match[1]);
      return match[2].trim();
    }
    return cmd;
  };
  const trimOutput = (s: string, limit = 2000) => {
    if (!s) return "";
    if (s.length <= limit) return s;
    const half = Math.floor(limit / 2);
    return s.slice(0, half) + "\n...\n" + s.slice(-half);
  };

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const agentResponse = await terminalStep(
      event,
      apiKey,
      currentContext,
      iteration,
    );

    if (!agentResponse.success) {
      LOG(TAG).ERROR(
        "terminal agent failed:" + agentResponse.error || "Unknown error",
      );
      executionLog.push({
        iteration,
        context: currentContext,
        command: "ERROR",
        output: agentResponse.error || "Agent failed",
        success: false,
      });
      break;
    }

    if (agentResponse.command === "DONE") {
      executionLog.push({
        iteration,
        context: currentContext,
        command: "DONE",
        output: "Task completed successfully",
        success: true,
      });
      return { output: currentContext };
    }

    // Validate command is not empty before execution
    const commandToExecute = agentResponse.command.trim();
    if (!commandToExecute) {
      LOG(TAG).WARN("Empty command received from LLM, skipping execution");
      currentContext = `${agentResponse.updatedContext}\n\nError: Empty command received. Continuing to next iteration.`;
      continue;
    }

    const prepared = applyCd(commandToExecute);
    LOG(TAG).INFO("executing:" + prepared + " @ " + currentCwd);
    const commandResult = await terminalTool(
      event,
      prepared,
      false,
      currentCwd,
    );

    // Send command output to UI
    event.sender.send("stream-chunk", {
      chunk: `${commandResult.output}\n`,
      type: "log",
    });
    if (commandResult.needConformation) {
      event.sender.send("stream-chunk", {
        chunk: `REQUIRES CONFIRMATION: ${commandResult.reason}\n`,
        type: "log",
      });
      blockedCount++;
    }

    executionLog.push({
      iteration,
      context: currentContext,
      command: prepared,
      output: commandResult.output,
      success: commandResult.success,
    });

    const snippet = trimOutput(commandResult.output);
    currentContext = `${agentResponse.updatedContext}\n\nCWD: ${currentCwd}\nLast Command: ${prepared}\nOutput: ${snippet}`;

    if (!commandResult.success) {
      currentContext += `\nCommand failed with error: ${commandResult.reason}`;
      // Send error information to UI
      event.sender.send("stream-chunk", {
        chunk: `ERROR: ${commandResult.reason}\n`,
        type: "log",
      });
    }
    if (commandResult.needConformation) {
      currentContext += `\nBlocked by safety policy: ${commandResult.reason}\nChoose a safe, read-only alternative or set "DONE" if goal is satisfied.`;
      // Stop if repeatedly blocked
      if (blockedCount >= 2) {
        LOG(TAG).WARN("stopping: repeatedly blocked by safety policy");
        break;
      }
      continue;
    }

    const repeat = prepared === lastCommand && snippet === lastOutputSnippet;
    if (repeat) {
      LOG(TAG).WARN("stalled: repeated command/output");
      currentContext += `\nDetected stall: same command/output repeated. Stopping.`;
      break;
    }
    lastCommand = prepared;
    lastOutputSnippet = snippet;
  }

  LOG(TAG).WARN("max iterations reached");
  LOG(TAG).WARN(
    "task may not be fully completed. consider increasing maxIterations or checking the plan.",
  );

  return { output: currentContext };
};

// Function declaration for Groq tool use
export const executeCommandFD = {
  type: "function" as const,
  function: {
    name: "executeCommand",
    description:
      "Execute a terminal command safely with security checks. Use this to run system commands, file operations, get date time or any terminal-based tasks",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "The terminal command to execute (e.g., 'ls -la', 'pwd', 'cat file.txt')",
        },
        confirmed: {
          type: "boolean",
          description:
            "Whether the user has confirmed execution of potentially dangerous commands. Set to true if the user explicitly approves the command.",
          default: false,
        },
      },
      required: ["command"],
    },
  },
};

// terminalAgent("size of app folder in ~/Code", 20).then((response) => {
//   log.GREEN(response);
// });
