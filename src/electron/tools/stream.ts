import { tools, getPlan } from "./plan.js";
import { generalTool } from "./general/index.js";
import { terminalAgent } from "./terminal/index.js";
import { preProcessMessage } from "./pre/index.js";
import { ChatMessageRecord, MakePlanResponse } from "../../common/types.js";
import { IpcMainInvokeEvent } from "electron";
import { LOG, JSON_PRINT } from "../utils/logging.js";
const TAG = "stream";
const router = async (
  plan: MakePlanResponse[],
  messages: ChatMessageRecord[],
  event: IpcMainInvokeEvent,
  apiKey: string,
): Promise<string> => {
  LOG(TAG).INFO(
    "router called with plan",
    JSON_PRINT(plan),
    "and messages count:",
    messages.length,
  );
  const updatedPlan: MakePlanResponse[] = [];
  let result: { output: string } = { output: "" };
  for (let i = 0; i < plan.length; i++) {
    const { step_number, description, status, tool_name } = plan[i];
    event.sender.send("stream-chunk", {
      chunk: `Processing plan step ${step_number}: ${description}\n\n`,
      type: "log",
    });

    if (tool_name === "general_tool") {
      result = await generalTool(
        messages,
        description +
          (result.output ? "\n\nPrevious step result: " + result.output : ""),
        event,
        apiKey,
      );
    } else if (tool_name === "terminal_tool") {
      result = await terminalAgent(description, event, apiKey);
    } else {
      // Fallback for any unknown tool
      result = { output: `Unknown tool: ${tool_name}` };
    }

    updatedPlan.push({ step_number, description, status: "done", tool_name });
    LOG(TAG).INFO(
      "updatedPlan",
      JSON_PRINT(updatedPlan),
      "result",
      JSON_PRINT(result),
    );
  }
  return result.output;
};

// TODO: better handle context of previous messages
export const stream = async (
  event: any,
  messages: ChatMessageRecord[],
  config: any,
  apiKey: string,
) => {
  try {
    const filteredMessages = messages.filter(
      (msg) => msg.type === "user" || msg.type === "stream",
    );

    const lastUserMessage = await preProcessMessage(
      filteredMessages.pop()!,
      event,
      apiKey,
      config,
    );
    const updatedMessages = [
      ...filteredMessages.slice(0, filteredMessages.length - 1),
      lastUserMessage,
    ];

    const plan = await getPlan(event, updatedMessages, apiKey);

    event.sender.send("stream-chunk", {
      chunk: JSON.stringify(plan.steps, null, 2),
      type: "plan",
    });
    LOG(TAG).INFO("plan", JSON_PRINT(plan.steps));
    const finalResponse = await router(
      plan.steps,
      updatedMessages,
      event,
      apiKey,
    );

    // Return final assistant text so renderer can know streaming is complete
    return { text: finalResponse };
  } catch (error) {
    LOG(TAG).ERROR("error in stream", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
