import { Groq } from "groq-sdk";
import { getAvailableTools, tools } from "./registry.js";
import { masterFileToolExecutionPrompt, masterFileToolSystemPrompt } from "./prompt.js";
import { ChatCompletionTool } from "groq-sdk/resources/chat/completions.mjs";

const groq = new Groq();

const getPlan = async (prompt: string): Promise<{ context: string | null; executionPlan: string | null }> => {
  try {
    const availableTools = getAvailableTools();
    const systemPrompt = masterFileToolSystemPrompt;

    const toolDescriptions = Object.values(availableTools)
      .map((tool) => JSON.stringify(tool, null, 2))
      .join("\n");
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
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
    const executionPlan = result?.match(/<execution_plan>([\s\S]*?)<\/execution_plan>/)?.[1].trim();
    if (!context || !executionPlan) {
      return { context: null, executionPlan: null };
    }
    return { context, executionPlan };
  } catch (error) {
    throw error;
  }
};

const executePlan = async (executionPlan: string, context: string) => {
  const systemPrompt = masterFileToolExecutionPrompt;

  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: systemPrompt,
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
  return response.choices[0].message.content;
};

const masterFileTool = async (prompt: string, maxOperations = 5) => {
  try {
    const { context, executionPlan } = await getPlan(prompt);
    if (!context || !executionPlan) throw new Error("No context or execution plan found");

    // now we need to execute the execution plan

    const result = await executePlan(executionPlan, context);
    return result;
  } catch (error) {
    console.error(error);
  }
};

console.log(
  await masterFileTool("convert the python file in Documents/python-code to js file move it to Documents/js-code")
);
