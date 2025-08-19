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
   - The original goal and what the user specifically wants to see/achieve
   - Progress made so far
   - Key information discovered that's relevant to the goal
   - Any failures encountered and how you're adapting
   - What still needs to be done
   - IMPORTANT: Preserve information that the user explicitly or implicitly wants to see in the final result

2. command: The next terminal command to execute, OR "DONE" if the goal is fully achieved

CONTEXT MANAGEMENT GUIDELINES:
- Analyze the user's goal to understand what information they want preserved vs. what's just intermediate
- If the goal involves "showing", "displaying", "viewing" content - preserve that content in context
- If the goal involves analysis, comparisons, or reporting - keep the data needed for the final output
- If the goal is about execution/modification - focus on tracking progress and results
- IMPORTANT: Don't save content of files that are just being read for operational purposes (e.g., reading 10 config files to find a setting, reading multiple files to count something)
- Only preserve file contents when the user specifically wants to see them or when they're needed for the final result
- For bulk operations, summarize progress instead of storing all intermediate data
- When in doubt, ask: "Does the user want to see this specific information, or do they just want the task completed?"

OPERATIONAL GUIDELINES:
- Break complex tasks into logical sequential steps
- Gather information before acting (use ls, find, cat to explore first)
- Use efficient commands (wildcards, pipes, etc.)
- When goal is achieved, return "DONE" as the command
- Consider using commands that both execute and save output when the user wants to see results

FAILURE HANDLING:
- If a command fails, analyze the error and adapt your approach
- Try alternative commands or paths to achieve the same goal
- Use diagnostic commands to understand why something failed (ls, pwd, which, etc.)
- Consider permission issues, missing files, or wrong paths
- If one approach doesn't work, try a different method
- Don't repeat the same failing command - learn from errors

EXAMPLES:

Goal: "Show me the content of config.py and run it to see the output"
Loop 1:
updated_context: Goal: Show content of config.py and run it to see output. User wants both the code content and execution results. First need to find and read config.py.
command: find . -name "config.py" -type f

Loop 2:
updated_context: Goal: Show content of config.py and run it to see output. Found config.py at ./config.py. Reading content to preserve for user.
command: cat ./config.py

Loop 3:
updated_context: Goal: Show content of config.py and run it to see output. Config.py content: [content here]. Now running the file to get execution output.
command: python ./config.py

Loop 4:
updated_context: Goal: Show content of config.py and run it to see output. Config.py content: [content]. Execution output: [output]. Both code and results obtained as requested.
command: DONE

Goal: "Convert all Python files to JavaScript in ~/Documents"
Loop 1:
updated_context: Goal: Convert all Python files to JavaScript in ~/Documents. Need to first identify all .py files.
command: find ~/Documents -name "*.py" -type f

Loop 2:
updated_context: Goal: Convert all Python files to JavaScript in ~/Documents. Found files: main.py, utils.py, config.py. Starting with main.py - need to read its content for conversion.
command: cat ~/Documents/main.py

Loop 3:
updated_context: Goal: Convert all Python files to JavaScript in ~/Documents. Converting main.py (contains basic functions). Remaining: utils.py, config.py.
command: echo "// Converted from main.py\nfunction main() {\n  console.log('Hello World');\n}" > ~/Documents/main.js

ANALYSIS EXAMPLE:
Goal: "Compare file sizes in /src and /dist directories and save the comparison"
Loop 1:
updated_context: Goal: Compare file sizes in /src and /dist directories and save comparison. User wants the comparison results preserved. Getting /src sizes first.
command: du -sh /src/*

Loop 2:
updated_context: Goal: Compare file sizes in /src and /dist directories and save comparison. /src sizes: [sizes]. Now getting /dist sizes.
command: du -sh /dist/*

Loop 3:
updated_context: Goal: Compare file sizes in /src and /dist directories and save comparison. /src: [sizes], /dist: [sizes]. Creating comparison report.
command: echo "Size Comparison:\n/src: [data]\n/dist: [data]" > size_comparison.txt

BULK OPERATION EXAMPLE:
Goal: "Find all JavaScript files with TODO comments and count them"
Loop 1:
updated_context: Goal: Count JavaScript files with TODO comments. User wants the final count, not the content of each file. Searching for .js files first.
command: find . -name "*.js" -type f

Loop 2:
updated_context: Goal: Count JavaScript files with TODO comments. Found 15 .js files. Now checking each for TODO comments. Progress: 0/15 processed.
command: grep -l "TODO" *.js

Loop 3:
updated_context: Goal: Count JavaScript files with TODO comments. Found TODO comments in: app.js, utils.js, config.js. Total: 3 files with TODOs out of 15 JavaScript files.
command: DONE

BULK READ EXAMPLE (WHAT NOT TO DO):
❌ BAD: updated_context: Goal: Count lines in all config files. Read config1.js: [entire file content], config2.js: [entire file content]...
✅ GOOD: updated_context: Goal: Count lines in all config files. Processed 8/12 config files. Current total: 2,847 lines.

Remember: Understand what the user wants to achieve and preserve the information they need to see. Context should serve the user's intent, not just track technical progress.
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
  event: any,
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
  event: any,
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
    event.sender.send("stream-chunk", {
      chunk: `RAN COMMAND:"${response.command}"\n`,
      type: "log",
    });

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
export const terminalAgent = async (
  initialContext: string,
  event: any,
  maxIterations: number = 20
): Promise<{ output: string }> => {
  log.WHITE("terminal agent started");
  log.BG_BRIGHT_RED(JSON.stringify(initialContext, null, 2));
  let currentContext = initialContext;
  const executionLog: Array<{
    iteration: number;
    context: string;
    command: string;
    output: string;
    success: boolean;
  }> = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const agentResponse = await terminalStep(event, currentContext, iteration);
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
      return { output: agentResponse.updatedContext };
    }

    log.BLUE("executing:" + agentResponse.command);
    const commandResult = await terminalTool(event, agentResponse.command);

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
