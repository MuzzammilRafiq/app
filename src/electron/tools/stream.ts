import { preProcessMessage } from "./pre/index.js";
import { orchestrate } from "./orchestrator.js";
import { ChatMessageRecord } from "../../common/types.js";
import { LOG } from "../utils/logging.js";
import { type ChatStreamContext, sendChatChunk } from "../utils/chat-stream.js";

const TAG = "stream";
export const stream = async (
  event: any,
  messages: ChatMessageRecord[],
  config: any,
  apiKey: string,
  requestId: string,
  signal?: AbortSignal,
) => {
  try {
    const filteredMessages = messages.filter(
      (msg) =>
        msg.type === "user" ||
        msg.type === "general" ||
        msg.type === "plan",
    );

    // Safety check for empty messages
    if (filteredMessages.length === 0) {
      return {
        text: "",
        error: "No messages to process",
      };
    }

    const lastMessage = filteredMessages[filteredMessages.length - 1]!;
    const scopedEvent = {
      ...event,
      sessionId: lastMessage.sessionId,
      requestId,
    };

    const lastUserMessage = await preProcessMessage(
      filteredMessages.pop()!, // Removes last message from array
      scopedEvent,
      apiKey,
      config,
      signal,
    );

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    // FIX #1: After pop(), filteredMessages already has last message removed
    // No need to slice again - just spread the remaining messages
    const updatedMessages = [...filteredMessages, lastUserMessage];
    const sessionId = lastUserMessage.sessionId;
    const context: ChatStreamContext = { sessionId, requestId };

    // Delegate to orchestrator for plan generation and execution
    const orchestratorEvent = { ...event, ...context };
    const result = await orchestrate(
      updatedMessages,
      orchestratorEvent,
      apiKey,
      sessionId,
      config,
      signal,
    );

    if (result.error) {
      sendChatChunk(event.sender, context, `Error: ${result.error}`, "log");
      return {
        text: "",
        error: result.error,
      };
    }

    sendChatChunk(event.sender, context, "*Chat agent done*", "log");
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    // Get sessionId from the last message if available
    const sessionId =
      messages.length > 0 ? messages[messages.length - 1].sessionId : undefined;
    // Send error to frontend so the chat can end properly
    if (sessionId) {
      sendChatChunk(
        event.sender,
        { sessionId, requestId },
        `Error: ${errorMessage}`,
        "error",
      );
    }
    return {
      text: "",
      error: errorMessage,
    };
  }
};
