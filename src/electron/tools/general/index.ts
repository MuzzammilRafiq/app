import { ASK_TEXT, type ChatMessage } from "../../services/model.js";
import { LOG, truncate } from "../../utils/logging.js";
import { ChatMessageRecord } from "../../../common/types.js";
import { StreamChunkBuffer } from "../../utils/stream-buffer.js";

const TAG = "general";
export const generalTool = async (
  messages: ChatMessageRecord[],
  taskDescription: string,
  event: any,
  apiKey: string,
  config: any,
  signal?: AbortSignal
): Promise<{ output: string }> => {
  const buffer = new StreamChunkBuffer(event.sender);

  try {
    LOG(TAG).INFO("taskDescription:", taskDescription);
    LOG(TAG).INFO("messages count:", messages.length);

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const system = `You are a helpful AI assistant. You have access to the full conversation history below.

Current task: ${taskDescription}

Provide a clear, concise, well-formatted markdown response based on the conversation context and the current task. Do not wrap the output in \`\`\`markdown\`\`\`.`;

    // Convert ChatMessageRecord[] to ChatMessage[] for the LLM
    const chatHistory: ChatMessage[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const response = ASK_TEXT(
      apiKey,
      [{ role: "system", content: system }, ...chatHistory],
      { overrideModel: config?.textModelOverride, signal }
    );
    if (!response) {
      throw new Error("No response content received from LLM");
    }
    let c = "";
    for await (const { content, reasoning } of response) {
      if (signal?.aborted) {
        buffer.flush();
        break;
      }
      if (content) {
        c += content;
      }
      if (reasoning) {
        buffer.send(reasoning, "log");
      }
      if (content) {
        buffer.send(content, "stream");
      }
    }
    buffer.flush();
    LOG(TAG).INFO(`Response generated: ${truncate(c, 100)}`);
    // Streaming complete - no need to send final chunk

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    return { output: c };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error; // Re-throw abort error to be handled by caller
    }
    LOG(TAG).ERROR(
      `[generalTool] Error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return {
      output: `# Error\n\nSorry, I encountered an error while processing your request:\n\n\`${error instanceof Error ? error.message : "Unknown error"}\`\n\nPlease try again or contact support if the issue persists.`,
    };
  }
};
