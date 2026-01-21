import { preProcessMessage } from "./pre/index.js";
import { orchestrate } from "./orchestrator.js";
import { ChatMessageRecord } from "../../common/types.js";
import { LOG ,JSON_PRINT} from "../utils/logging.js";

const TAG = "stream";
export const stream = async (
  event: any,
  messages: ChatMessageRecord[],
  config: any,
  apiKey: string,
  signal?: AbortSignal
) => {
  try {
    LOG(TAG).INFO(JSON_PRINT(config));
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
      config,
      signal
    );

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    // FIX #1: After pop(), filteredMessages already has last message removed
    // No need to slice again - just spread the remaining messages
    const updatedMessages = [...filteredMessages, lastUserMessage];
    const sessionId = lastUserMessage.sessionId;

    LOG(TAG).INFO(`Starting orchestration for session ${sessionId}`);

    // Delegate to orchestrator for plan generation and execution
    const result = await orchestrate(
      updatedMessages,
      event,
      apiKey,
      sessionId,
      config,
      signal
    );

    if (result.error) {
      event.sender.send("stream-chunk", {
        chunk: `Error: ${result.error}`,
        type: "log",
      });
      return {
        text: "",
        error: result.error,
      };
    }

    event.sender.send("stream-chunk", {
      chunk: "*General tool done*",
      type: "log",
    });
    return { text: result.text };
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.message === "Aborted")
    ) {
      LOG(TAG).INFO("Stream cancelled by user");
      return {
        text: "",
        error: "Cancelled",
      };
    }
    LOG(TAG).ERROR("error in stream", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
