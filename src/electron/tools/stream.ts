import chalk from "chalk";
import { GoogleGenAI } from "@google/genai";
import { tools, getPlan } from "./plan.js";
import log from "../../common/log.js";
import { extractImage } from "./extract-image/index.js";
import { MakePlanResponse } from "../../common/types.js";
import { EventChannels, Labels } from "../../common/constants.js";

const router = async (plan: MakePlanResponse[], context: string, event: any): Promise<string> => {
  log.BLUE(`router called with plan: ${JSON.stringify(plan)} and context: ${context}`);
  const updatedPlan: MakePlanResponse[] = [];
  let result: { output: string } = { output: "" };
  for (let i = 0; i < plan.length; i++) {
    const { step_number, description, status, tool_name } = plan[i];
    const toolFunction = tools[tool_name as keyof typeof tools].function;
    event.sender.send(EventChannels.STREAM_CHUNK, {
      chunk: `Processing plan step ${step_number}: ${description}\n\n`,
      type: Labels.LOG, 
    });

    if (tool_name === "general_tool") {
      result = await toolFunction(description + "\n" + result.output, event);
    } else {
      result = await toolFunction(description, event);
    }

    updatedPlan.push({ step_number, description, status: "done", tool_name });
    log.BLUE(JSON.stringify({ step_number, description, status: "done", tool_name }, null, 2));
  }
  return result.output;
};

// NOTE: WE are only considering last message for now
export const stream = async (event: any, messages: any[]) => {
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const lastUserMessage = await extractImage(ai, messages.pop(), event);
    // const updatedMessages = [...messages.slice(0, messages.length - 1), lastUserMessage];

    const plan = await getPlan(lastUserMessage.content);

    event.sender.send(EventChannels.STREAM_CHUNK, {
      chunk: JSON.stringify(plan.steps, null, 2),
      type: Labels.PLAN,
    });

    log.BLUE(`plan: ${JSON.stringify(plan, null, 2)}`);
    const finalResponse = await router(plan.steps, lastUserMessage.content, event);

    // Return final assistant text so renderer can know streaming is complete
    return { text: finalResponse };
  } catch (error) {
    console.log(chalk.red("Error calling Gemini API with streaming:", error));
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

// if (require.main === module) {
//   stream(null, [
//     { id: 1, content: "what is the current date", role: "user", timestamp: new Date().toISOString() },
//   ]).then((response) => {
//     console.log(response);
//   });
// }
