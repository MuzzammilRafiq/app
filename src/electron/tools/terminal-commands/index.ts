import { exec } from "child_process";
import { promisify } from "util";

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

const executeCommand = async (
  command: string,
  confirmed = false
): Promise<{ output: string; needConformation: boolean; reason: string; success: boolean }> => {
  try {
    const { needConformation, reason } = checkCommandSecurity(command);

    if (needConformation && !confirmed) {
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

// Function declaration for Groq tool use
export const executeCommandTool = {
  type: "function" as const,
  function: {
    name: "executeCommand",
    description:
      "Execute a terminal command safely with security checks. Use this to run system commands, file operations, or any terminal-based tasks.",
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

// Export the executeCommand function for use with the tool
export { executeCommand };
