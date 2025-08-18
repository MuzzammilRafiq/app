import { exec } from "child_process";
import { promisify } from "util";
import { groq } from "../../services/groq.js";
import log from "../../../common/log.js";
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
];
const PROMPT = (context: string) => `
You are a terminal command agent designed to achieve complex goals through sequential terminal operations.

CONTEXT: ${context}

Your task is to analyze the current context and determine the next terminal command needed to progress toward the goal.

RESPONSE FORMAT:
You must respond with exactly 2 parts:

1. updated_context: An updated context string that includes:
   - The original goal
   - Progress made so far
   - Key information discovered (file names, contents when relevant, etc.)
   - Any failures encountered and how you're adapting
   - What still needs to be done
   - Keep it concise but informative

2. command: The next terminal command to execute, OR "DONE" if the goal is fully achieved

GUIDELINES:
- Break complex tasks into logical sequential steps
- Gather information before acting (use ls, find, cat to explore first)
- Only include file contents in context when they're needed for the next steps
- Remove outdated information from context to keep it manageable
- Use efficient commands (wildcards, pipes, etc.)
- When goal is achieved, return "DONE" as the command

FAILURE HANDLING:
- If a command fails, analyze the error and adapt your approach
- Try alternative commands or paths to achieve the same goal
- Use diagnostic commands to understand why something failed (ls, pwd, which, etc.)
- Consider permission issues, missing files, or wrong paths
- If one approach doesn't work, try a different method
- Don't repeat the same failing command - learn from errors

EXAMPLES:

Goal: "Convert all Python files to JavaScript in ~/Documents"
Loop 1:
updated_context: Goal: Convert all Python files to JavaScript in ~/Documents. Need to first identify all .py files.
command: find ~/Documents -name "*.py" -type f

Loop 2:
updated_context: Goal: Convert all Python files to JavaScript in ~/Documents. Found files: main.py, utils.py, config.py. Starting with main.py - need to read its content.
command: cat ~/Documents/main.py

Loop 3:
updated_context: Goal: Convert all Python files to JavaScript in ~/Documents. Files to convert: main.py (contains basic functions), utils.py, config.py. Converting main.py to JavaScript.
command: echo "// Converted from main.py\nfunction main() {\n  console.log('Hello World');\n}" > ~/Documents/main.js

FAILURE EXAMPLE:
Goal: "Delete all .tmp files in /var/cache"
Loop 1:
updated_context: Goal: Delete all .tmp files in /var/cache. First need to check if directory exists and list .tmp files.
command: ls /var/cache/*.tmp

Loop 2 (after command failed with "Permission denied"):
updated_context: Goal: Delete all .tmp files in /var/cache. Previous command failed due to permission denied. Need to check current user permissions and try alternative approach. Will first check if directory exists and is accessible.
command: ls -la /var/cache

Loop 3 (if still fails):
updated_context: Goal: Delete all .tmp files in /var/cache. Cannot access /var/cache due to permissions. Will try checking user's accessible temp directories instead.
command: find /tmp -name "*.tmp" -type f

Remember: Only include information in updated_context that is relevant for upcoming steps. Be efficient and goal-oriented. Always adapt when commands fail.
`;
const checkCommandSecurity = (command: string): { needConformation: boolean; reason: string } => {
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
  command: string,
  confirm = true
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
      reason: stderr ? "Command executed with warnings/info messages" : "Command executed successfully",
      success: true,
    };
  } catch (error: any) {
    console.log(error);
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
  context: string,
  index: number
): Promise<{
  updatedContext: string;
  command: string;
  success: boolean;
  error?: string;
}> => {
  try {
    log.BLUE(`Terminal Agent Iteration ${index}`);
    // console.log(chalk.dim(context.substring(0, 1000) + (context.length > 1000 ? "..." : "")));

    const prompt = PROMPT(context);

    const options = {
      temperature: 0.5,
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "terminal_agent_response",
          schema: {
            type: "object",
            properties: {
              updated_context: {
                type: "string",
                description: "Updated context string including progress and relevant information for next steps",
              },
              command: {
                type: "string",
                description: "Next terminal command to execute, or 'DONE' if goal is achieved",
              },
            },
            required: ["updated_context", "command"],
            additionalProperties: false,
          },
        },
      },
      stream: false,
    };
    const content = await groq.chat("moonshotai/kimi-k2-instruct", options);

    if (!content) {
      throw new Error("No response content received from LLM");
    }

    const response: {
      updated_context: string;
      command: string;
    } = JSON.parse(content);

    log.MAGENTA(response.command, response.updated_context);

    return {
      updatedContext: response.updated_context,
      command: response.command,
      success: true,
    };
  } catch (error: any) {
    log.RED("❌ Terminal Agent Error:" + error.message);
    return {
      updatedContext: context,
      command: "DONE",
      success: false,
      error: error.message,
    };
  }
};

// Multi-step Terminal Agent Function
export const terminalAgent = async (initialContext: string, maxIterations: number = 20): Promise<string> => {
  log.WHITE("terminal agent started");

  let currentContext = initialContext;
  const executionLog: Array<{
    iteration: number;
    context: string;
    command: string;
    output: string;
    success: boolean;
  }> = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const agentResponse = await terminalStep(currentContext, iteration);
    if (!agentResponse.success) {
      log.RED("terminal agent failed:" + agentResponse.error || "Unknown error");
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
      return agentResponse.updatedContext;
    }

    log.BLUE("executing:" + agentResponse.command);
    const commandResult = await terminalTool(agentResponse.command);

    executionLog.push({
      iteration,
      context: currentContext,
      command: agentResponse.command,
      output: commandResult.output,
      success: commandResult.success,
    });

    currentContext = `${agentResponse.updatedContext}\n\nLast Command: ${agentResponse.command}\nOutput: ${commandResult.output}`;

    if (!commandResult.success) {
      currentContext += `\nCommand failed with error: ${commandResult.reason}`;
    }
  }

  log.RED("max iterations reached");
  log.YELLOW("task may not be fully completed. consider increasing maxIterations or checking the plan.");

  return currentContext;
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
          description: "The terminal command to execute (e.g., 'ls -la', 'pwd', 'cat file.txt')",
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
