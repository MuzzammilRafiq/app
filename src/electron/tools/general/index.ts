import { ASK_TEXT, type ChatMessage } from "../../services/llm.js";
import { LOG, JSON_PRINT } from "../../utils/logging.js";
import { ChatMessageRecord } from "../../../common/types.js";

const TAG = "general";
export const generalTool = async (
  messages: ChatMessageRecord[],
  taskDescription: string,
  event: any,
  apiKey: string,
): Promise<{ output: string }> => {
  try {
    LOG(TAG).INFO("taskDescription:", taskDescription);
    LOG(TAG).INFO("messages count:", messages.length);

    const system = `You are a helpful AI assistant. You have access to the full conversation history below.

Current task: ${taskDescription}

Provide a clear, concise, well-formatted markdown response based on the conversation context and the current task. Do not wrap the output in \`\`\`markdown\`\`\`.`;

    // Convert ChatMessageRecord[] to ChatMessage[] for the LLM
    const chatHistory: ChatMessage[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const response = ASK_TEXT(apiKey, [
      { role: "system", content: system },
      ...chatHistory,
    ]);
    if (!response) {
      throw new Error("No response content received from LLM");
    }
    let c = "";
    for await (const { content, reasoning } of response) {
      if (content) {
        c += content;
      }
      if (reasoning) {
        event.sender.send("stream-chunk", {
          chunk: reasoning,
          type: "log",
        });
      }
      if (content) {
        event.sender.send("stream-chunk", {
          chunk: content,
          type: "stream",
        });
      }
    }
    LOG(TAG).INFO(JSON_PRINT(c));
    // Streaming complete - no need to send final chunk

    return { output: c };
  } catch (error) {
    LOG(TAG).ERROR(
      `[generalTool] Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return {
      output: `# Error\n\nSorry, I encountered an error while processing your request:\n\n\`${error instanceof Error ? error.message : "Unknown error"}\`\n\nPlease try again or contact support if the issue persists.`,
    };
  }
};
