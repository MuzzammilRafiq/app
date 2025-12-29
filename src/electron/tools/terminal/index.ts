import { exec } from "child_process";
import { promisify } from "util";
import { ASK_TEXT, type ChatMessage } from "../../services/model.js";
import { LOG, JSON_PRINT } from "../../utils/logging.js";
import path from "node:path";
import os from "node:os";
const TAG = "terminal";
const execAsync = promisify(exec);

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
  "at ",
  "nohup",
  "&",
  "python -c",
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
// Allowlist: safe base commands for read-only/introspection
const ALLOWED_BASE_COMMANDS = [
  "ls",
  "pwd",
  "echo",
  "cat",
  "head",
  "tail",
  "wc",
  "du",
  "df",
  "date",
  "which",
  "stat",
  "basename",
  "dirname",
  "printf",
  // navigation handled via special cd logic
  "DONE",
];
const MULTI_COMMAND_PATTERN = /(\||;|&&)/;
const extractBase = (command: string) => {
  const trimmed = command.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("cd ")) return "cd";
  const first = trimmed.split(/\s+/)[0];
  return first;
};
const PROMPT = (context: string) => `
You are a macOS terminal agent. Produce only a single JSON object matching the schema:
{"updated_context":"string","command":"string"}

Rules:
- macOS paths/commands only
- Non‑interactive, idempotent, safe operations
- Prefer absolute or verified relative paths
- Use ls/pwd/which to verify before acting
- No network/destructive/system modifications
- Single command only (no pipes/semicolons/&&). Use only allowed commands: ${ALLOWED_BASE_COMMANDS.join(", ")} and cd
- Output "DONE" when goal achieved
- If a command would be blocked by safety rules, propose a safe alternative instead

Context:
${context}

Examples:
{"updated_context":"Goal: list app dir. Verified cwd. Next: list src.","command":"ls -la"}
{"updated_context":"Goal completed. Collected sizes for src/dist.","command":"DONE"}
`;
const SYSTEM_PROMPT = `
You are a macOS terminal agent. Output only a single JSON object with keys: updated_context, command. No extra text.
- Non‑interactive, macOS‑compatible, idempotent commands
- Avoid network and destructive/system ops
- Prefer absolute or verified relative paths
- Verify with ls/pwd before acting
- Use "DONE" when the goal is achieved
- Minimal steps: never run exploratory commands once the requested result is obtained
- Decide using context: if last output satisfies the user’s goal, set command to "DONE"
- For single-output goals like “show”, “print”, “get”, use exactly one command then "DONE"
- updated_context must preserve the specific STDOUT needed to satisfy the user’s goal (e.g., the time string for "get current time")
- Strict constraints:
- - Use only one command per step (no pipes/semicolons/&&)
- - Use only allowed base commands: ${ALLOWED_BASE_COMMANDS.join(", ")} and cd
- - If a needed action is disallowed, choose a read-only alternative or set command to "DONE" if goal satisfied
`;
const checkCommandSecurity = (
  command: string
): { needConformation: boolean; reason: string } => {
  const normalizedCommand = command.toLowerCase().trim();

  // Disallow multi-command chaining or piping
  if (MULTI_COMMAND_PATTERN.test(normalizedCommand)) {
    return {
      needConformation: true,
      reason: "Multiple commands/pipes detected. Single safe command required",
    };
  }

  // Allow cd for navigation; all other commands must be on the allowlist
  const base = extractBase(normalizedCommand);
  if (base && base !== "cd" && !ALLOWED_BASE_COMMANDS.includes(base)) {
    return {
      needConformation: true,
      reason: `Command not allowed: "${base}". Allowed: ${ALLOWED_BASE_COMMANDS.join(", ")}`,
    };
  }

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
    const { needConformation, reason } = checkCommandSecurity(command);

    if (needConformation && !confirm) {
      return { output: "", needConformation, reason, success: false };
    }

    const { stdout, stderr } = await execAsync(command, {
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

// Terminal Agent Function
export const terminalStep = async (
  event: any,
  apiKey: string,
  context: string,
  index: number,
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
    };
    let parsed: { updated_context: string; command: string } | null = null;
    let tries = 0;
    while (!parsed && tries < 2) {
      const response = ASK_TEXT(apiKey, M, options);
      if (!response) {
        throw new Error("No response content received from LLM");
      }
      let c = "";
      for await (const { content, reasoning } of response) {
        if (content) {
          c += content;
        }
        if (reasoning) {
          event.sender.send("stream-chunk", {
            chunk: reasoning,
            type: "log",
          });
        }
      }
      let cleaned = c
        .replace(/[\x00-\x1F\x7F]/g, (char) => {
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
    const expanded =
      p.startsWith("~") ? path.join(home, p.slice(1)) : p;
    return path.isAbsolute(expanded)
      ? expanded
      : path.resolve(base, expanded);
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
    const commandResult = await terminalTool(event, prepared, false, currentCwd);

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

    const repeat =
      prepared === lastCommand && snippet === lastOutputSnippet;
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
