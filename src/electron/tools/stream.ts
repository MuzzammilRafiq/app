import { tools, getPlan } from "./plan.js";
import { generalTool } from "./general/index.js";
import { terminalAgent } from "./terminal/index.js";
import { preProcessMessage } from "./pre/index.js";
import { ChatMessageRecord, MakePlanResponse } from "../../common/types.js";
import { IpcMainInvokeEvent } from "electron";
import { LOG, JSON_PRINT } from "../utils/logging.js";

const TAG = "stream";

/**
 * Execution context that accumulates results from all tools.
 * Each tool adds its results here, and general_tool uses this
 * to synthesize the final response.
 */
interface ExecutionContext {
  /** Results from each completed step */
  stepResults: Array<{
    stepNumber: number;
    toolName: string;
    description: string;
    output: string;
  }>;
  /** Accumulated context string for tools that need text context */
  accumulatedOutput: string;
}

/**
 * Router executes plan steps sequentially.
 * - Worker tools (terminal_tool, future tools) add their results to ExecutionContext
 * - general_tool receives full context to synthesize final user response
 */
const router = async (
  plan: MakePlanResponse[],
  messages: ChatMessageRecord[],
  event: IpcMainInvokeEvent,
  apiKey: string
): Promise<string> => {
  LOG(TAG).INFO(
    "router called with plan",
    JSON_PRINT(plan),
    "and messages count:",
    messages.length
  );

  // Initialize execution context
  const context: ExecutionContext = {
    stepResults: [],
    accumulatedOutput: "",
  };

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const { step_number, description, tool_name } = step;

    event.sender.send("stream-chunk", {
      chunk: `Processing step ${step_number}: ${description}\n\n`,
      type: "log",
    });

    let result: { output: string } = { output: "" };

    if (tool_name === "general_tool") {
      // general_tool receives accumulated context from all previous tools
      const contextSummary =
        context.stepResults.length > 0
          ? "\n\n<TOOL_RESULTS>\n" +
            context.stepResults
              .map(
                (r) =>
                  `[Step ${r.stepNumber} - ${r.toolName}]: ${r.description}\nResult: ${r.output}`
              )
              .join("\n\n") +
            "\n</TOOL_RESULTS>"
          : "";

      result = await generalTool(
        messages,
        description + contextSummary,
        event,
        apiKey
      );
    } else if (tool_name === "terminal_tool") {
      result = await terminalAgent(description, event, apiKey);
    } else {
      // Fallback for any unknown tool - log warning but continue
      LOG(TAG).WARN(`Unknown tool: ${tool_name}, skipping step`);
      result = { output: `Unknown tool: ${tool_name}` };
    }

    // Add result to execution context
    context.stepResults.push({
      stepNumber: step_number,
      toolName: tool_name,
      description,
      output: result.output,
    });
    context.accumulatedOutput += result.output + "\n";

    LOG(TAG).INFO(
      `Step ${step_number} completed`,
      JSON_PRINT({ tool: tool_name, outputLength: result.output.length })
    );
  }

  // Return the last result (should be from general_tool)
  const lastResult = context.stepResults[context.stepResults.length - 1];
  return lastResult?.output ?? "";
};

export const stream = async (
  event: any,
  messages: ChatMessageRecord[],
  config: any,
  apiKey: string
) => {
  try {
    const filteredMessages = messages.filter(
      (msg) => msg.type === "user" || msg.type === "stream"
    );

    // Safety check for empty messages
    if (filteredMessages.length === 0) {
      return {
        text: "",
        error: "No messages to process",
      };
    }

    const lastUserMessage = await preProcessMessage(
      filteredMessages.pop()!, // Removes last message from array
      event,
      apiKey,
      config
    );

    // FIX #1: After pop(), filteredMessages already has last message removed
    // No need to slice again - just spread the remaining messages
    const updatedMessages = [...filteredMessages, lastUserMessage];

    const planResult = await getPlan(event, updatedMessages, apiKey);

    // FIX #3: Check for error from getPlan
    if (planResult.error) {
      event.sender.send("stream-chunk", {
        chunk: `Error generating plan: ${planResult.error}`,
        type: "log",
      });
      return {
        text: "",
        error: planResult.error,
      };
    }

    if (planResult.steps.length === 0) {
      return {
        text: "",
        error: "No plan steps generated",
      };
    }

    event.sender.send("stream-chunk", {
      chunk: JSON.stringify(planResult.steps, null, 2),
      type: "plan",
    });

    LOG(TAG).INFO("plan", JSON_PRINT(planResult.steps));

    const finalResponse = await router(
      planResult.steps,
      updatedMessages,
      event,
      apiKey
    );

    return { text: finalResponse };
  } catch (error) {
    LOG(TAG).ERROR("error in stream", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
