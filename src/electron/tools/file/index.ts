import { Groq } from "groq-sdk";
import { executeTool, getAvailableTools, tools } from "./registry.js";
import { ExecutionPrompt2, SystemPrompt } from "./prompt.js";
import chalk from "chalk";
import { ChatCompletionTool } from "groq-sdk/resources/chat/completions.mjs";
import readline from "readline";
const groq = new Groq();

const getPlan = async (
  prompt: string,
): Promise<{ context: string | null; executionPlan: string | null }> => {
  const availableTools = getAvailableTools();
  const toolDescriptions = Object.values(availableTools)
    .map((tool) => JSON.stringify(tool, null, 2))
    .join("\n");
  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: SystemPrompt,
      },
      {
        role: "user",
        content: `
        <tools>
          ${toolDescriptions}
        </tools>
        <user_prompt>
          ${prompt}
        </user_prompt>
          `,
      },
    ],
    model: "moonshotai/kimi-k2-instruct",
    temperature: 0.6,
    max_completion_tokens: 4096,
    top_p: 1,
    stream: false,
    stop: null,
  });

  const result = response.choices[0].message.content;

  const context = result?.match(/<context>([\s\S]*?)<\/context>/)?.[1].trim();
  const executionPlan = result
    ?.match(/<execution_plan>([\s\S]*?)<\/execution_plan>/)?.[1]
    .trim();

  if (!context || !executionPlan) {
    console.error("Failed to extract context or execution plan from response", {
      hasContext: !!context,
      hasExecutionPlan: !!executionPlan,
      rawResult: result?.substring(0, 500) + "...",
    });
    return { context: null, executionPlan: null };
  }
  return { context, executionPlan };
};

// Extract function call information from AI response
const parseExecutionOutput = (output: string) => {
  const result = {
    plan: "",
    tool: "",
    parameters: "",
  };

  const planMatch = output.match(
    /<execution_plan>([\s\S]*?)<\/execution_plan>/,
  );
  if (planMatch) {
    result.plan = planMatch[1].trim();
  }

  const toolMatch = output.match(/<tool>([\s\S]*?)<\/tool>/);
  if (toolMatch) {
    result.tool = toolMatch[1].trim();
  }

  const parametersMatch = output.match(/<parameters>([\s\S]*?)<\/parameters>/);
  if (parametersMatch) {
    const parametersText = parametersMatch[1].trim();
    try {
      result.parameters = JSON.parse(parametersText);
    } catch (jsonError) {
      console.warn("Failed to parse parameters as JSON:", jsonError);
      result.parameters = parametersText; // Return as string if JSON parsing fails
    }
  }
  return result;
};

const stepPlan = async (executionPlan: string, context: string) => {
  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: ExecutionPrompt2,
      },
      {
        role: "user",
        content: `
        <execution_plan>
          ${executionPlan}
        </execution_plan>
        <context>
          ${context}
        </context>
        `,
      },
    ],
    tools: tools as ChatCompletionTool[],
    tool_choice: "auto",
    model: "moonshotai/kimi-k2-instruct",
    temperature: 0.6,
    max_completion_tokens: 4096,
    top_p: 1,
    stream: false,
    stop: null,
  });

  return response;
};

const waitForUserInput = (): Promise<void> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow("Press Enter to continue to next step..."), () => {
      rl.close();
      resolve();
    });
  });
};

const executePlanLoop = async (
  executionPlan: string,
  context: string,
  maxops = 5,
) => {
  let response = null;
  while (maxops > 0) {
    response = await stepPlan(executionPlan, context);
    console.log(chalk.green("_______________________"));
    console.log(chalk.green(response?.choices[0]?.message?.content));
    const r = parseExecutionOutput(
      response.choices[0].message.content as string,
    );
    const result = await executeTool(r.tool, r.parameters);
    console.log(chalk.green("result----", result));
    context += `output from tool ${r.tool}\n ${result}`;
    executionPlan = r.plan;
    maxops--;
    await waitForUserInput();
  }
  return response?.choices[0]?.message?.content || "Execution completed";
};

const masterFileTool = async (prompt: string) => {
  const { context, executionPlan } = await getPlan(prompt);
  const result = await executePlanLoop(executionPlan!, context!);
  return result;
};

if (require.main === module) {
  console.log(
    chalk.green(
      await masterFileTool(
        "convert the python file in Documents/python-code to js file move it to Documents/js-code",
      ),
    ),
  );
}
