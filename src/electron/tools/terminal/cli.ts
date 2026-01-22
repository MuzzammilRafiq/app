import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as readline from "readline";
import chalk from "chalk";

const execAsync = promisify(exec);

const CONFIG = {
  model: "openai/gpt-oss-120b",
  maxSteps: 30,
  commandTimeout: 30000,
  maxOutputBuffer: 1024 * 1024,
};

let currentCwd = process.cwd();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
};

const print = {
  header: (text: string) => console.log(chalk.bold.cyan(`\n╭─ ${text} ─╮\n`)),
  text: (text: string) => process.stdout.write(chalk.white(text)),
  reasoning: (text: string) => process.stdout.write(chalk.dim.italic(text)),
  command: (cmd: string) =>
    console.log(chalk.yellow(`\n⚡ Command: `) + chalk.bold.white(cmd)),
  success: (text: string) => console.log(chalk.green(`✓ ${text}`)),
  error: (text: string) => console.log(chalk.red(`✗ ${text}`)),
  warn: (text: string) => console.log(chalk.yellow(`⚠ ${text}`)),
  info: (text: string) => console.log(chalk.blue(`ℹ ${text}`)),
  reason: (text: string) => console.log(chalk.dim(`  ↳ ${text}`)),
  step: (n: number) => console.log(chalk.magenta(`\n── Step ${n} ──`)),
  output: (text: string) => {
    const lines = text.split("\n");
    console.log(chalk.dim("┌─ Output ─────────────────────────────────"));
    lines.forEach((line) => console.log(chalk.dim("│ ") + line));
    console.log(chalk.dim("└──────────────────────────────────────────"));
  },
  divider: () => console.log(chalk.dim("─".repeat(50))),
};

async function executeCommand(
  command: string,
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

async function confirmCommand(command: string): Promise<boolean> {
  print.command(command);
  const answer = await ask(chalk.yellow("  Execute? ") + chalk.dim("[y/n]: "));
  return answer === "y" || answer === "yes";
}
const executeCommandTool = tool({
  description:
    "Execute a terminal command. The command will be shown to the user for confirmation before execution.",
  inputSchema: z.object({
    command: z.string().describe("The terminal command to execute"),
    reason: z
      .string()
      .optional()
      .describe("Brief explanation of why this command is needed"),
  }),
  execute: async ({ command, reason }) => {
    if (reason) {
      print.reason(reason);
    }

    const confirmed = await confirmCommand(command);
    if (!confirmed) {
      print.error("Command rejected by user");
      return {
        executed: false,
        output:
          "User rejected the command. Please try a different approach or ask the user for guidance.",
        success: false,
      };
    }

    print.success("Executing...");
    const result = await executeCommand(command);
    print.output(result.output);

    return {
      executed: true,
      output: result.output,
      success: result.success,
    };
  },
});

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

Each command requires user confirmation before execution.`;

async function runAgent(apiKey: string, userMessage: string): Promise<void> {
  const openrouter = createOpenRouter(
    { apiKey, }
);

  print.divider();

  let stepCount = 0;
  let currentStepHasText = false;
  let hasReasoning = false;

  const result = streamText({
    model: openrouter(CONFIG.model),
    system: SYSTEM_PROMPT,
    prompt: `Current directory: ${currentCwd}\n\nUser request: ${userMessage}`,
    tools: {
      executeCommand: executeCommandTool,
    },
    stopWhen: stepCountIs(CONFIG.maxSteps),
    onStepFinish: ({ text, toolCalls, finishReason }) => {
      // Log step completion info
      console.log(chalk.red(text))
      console.log(chalk.bgRed(finishReason))
      if (toolCalls && toolCalls.length > 0) {
        print.info(`Tool executed`);
      }
    },
  });
  let p;
  try {
    // Process the fullStream to handle text before tool calls
    for await (const part of result.fullStream) {
      p = part;
      //   console.log(chalk.green(JSON.stringify(part, null, 2))); // For debugging purposes;
      switch (part.type) {
        case "start-step": {
          stepCount++;
          if (stepCount > 1) {
            print.step(stepCount);
          }
          currentStepHasText = false;
          hasReasoning = false;
          break;
        }

        case "reasoning-start": {
          process.stdout.write(chalk.dim.italic("\n💭 Thinking: "));
          hasReasoning = true;
          break;
        }

        case "reasoning-delta": {
          const reasoningContent =
            (part as any).text || (part as any).textDelta || "";
          print.reasoning(reasoningContent);
          break;
        }

        case "reasoning-end": {
          if (hasReasoning) {
            console.log("\n"); // Add clear separation after reasoning
          }
          break;
        }

        case "text-start": {
          process.stdout.write(chalk.cyan("\n🤖 Assistant: "));
          break;
        }

        case "text-delta": {
          const textContent =
            (part as any).text || (part as any).textDelta || "";
          print.text(textContent);
          currentStepHasText = true;
          break;
        }

        case "text-end": {
          if (currentStepHasText) {
            console.log(); // New line after text
          }
          break;
        }

        case "tool-call": {
          // Ensure clean separation before tool calls
          if (hasReasoning || currentStepHasText) {
            console.log();
          }
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
          print.error(`Stream error: ${(part as any).error}`);
          break;
        }
      }
    }
  } catch (error: any) {
    console.log(chalk.green(JSON.stringify(p, null, 2))); // For debugging purposes;
    print.error(`Agent error: ${error.message}`);
    process.exit(1);
  }

  // Await for completion
  await result;

  if (stepCount > 0) {
    print.success(`\nCompleted in ${stepCount} step(s)`);
  }
}

async function main() {
  console.clear();
  print.header("Terminal CLI Agent");

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    print.error("OPENROUTER_API_KEY environment variable is not set");
    print.info("Set it with: export OPENROUTER_API_KEY=your-api-key");
    process.exit(1);
  }

  print.info(`Model: ${CONFIG.model}`);
  print.info(`Working directory: ${currentCwd}`);
  print.divider();

  console.log(
    chalk.dim(
      'Type your request (or "exit" to quit, "clear" to clear screen)\n',
    ),
  );

  const promptUser = async () => {
    const input = await ask(chalk.green("You: "));

    if (input === "exit" || input === "quit") {
      print.success("Goodbye!");
      rl.close();
      process.exit(0);
    }

    if (input === "clear") {
      console.clear();
      print.header("Terminal CLI Agent");
      promptUser();
      return;
    }

    if (input.startsWith("cd ")) {
      const newDir = input.slice(3).trim();
      try {
        process.chdir(newDir);
        currentCwd = process.cwd();
        print.success(`Changed directory to: ${currentCwd}`);
      } catch {
        print.error(`Cannot change to directory: ${newDir}`);
      }
      promptUser();
      return;
    }

    if (!input) {
      promptUser();
      return;
    }

    try {
      await runAgent(apiKey, input);
    } catch (error: any) {
      print.error(`Error: ${error.message}`);
      if (error.cause) {
        console.log(chalk.dim(`  Cause: ${JSON.stringify(error.cause)}`));
      }
    }

    console.log();
    promptUser();
  };

  promptUser();
}

// Run if executed directly
main().catch((error) => {
  print.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

export { runAgent, executeCommand, confirmCommand };
