import { type ChatMessage } from "../../services/model.js";
import { LOG, truncate } from "../../utils/logging.js";
import { ChatMessageRecord } from "../../../common/types.js";
import { StreamChunkBuffer } from "../../utils/stream-buffer.js";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";

const TAG = "general";
export const generalTool = async (
  messages: ChatMessageRecord[],
  taskDescription: string,
  event: any,
  apiKey: string,
  config: any,
  signal?: AbortSignal,
): Promise<{ output: string }> => {
  const sessionId = messages[messages.length - 1]?.sessionId ?? "unknown";
  const buffer = new StreamChunkBuffer(event.sender, sessionId);

  try {
    LOG(TAG).INFO("taskDescription:", taskDescription);
    LOG(TAG).INFO("messages count:", messages.length);

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const system = `You are a helpful AI assistant. You have access to the full conversation history below.

Current task: ${taskDescription}

Provide a clear, concise, well-formatted markdown response based on the conversation context and the current task.
KEEP in MIND: Your response should be conslusive ur response is what user sees. you are the end part of the chain.
Do not wrap the output in \`\`\`markdown\`\`\`.`;

    // Convert ChatMessageRecord[] to ChatMessage[] for the LLM
    const chatHistory: ChatMessage[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const openrouter = createOpenRouter({ apiKey });
    const result = streamText({
      model: openrouter(config?.textModelOverride || "moonshotai/kimi-k2-0905"),
      system,
      messages: chatHistory,
      abortSignal: signal,
    });

    let c = "";
    for await (const part of result.fullStream) {
      if (signal?.aborted) {
        buffer.flush();
        throw new DOMException("Aborted", "AbortError");
      }
      switch (part.type) {
        case "reasoning-delta": {
          buffer.send(part.text, "log");
          break;
        }
        case "text-delta": {
          c += part.text;
          buffer.send(part.text, "general");
          break;
        }
        case "error": {
          buffer.send(`\nError: ${(part as any).error}\n`, "log");
          LOG(TAG).ERROR("Stream error:", (part as any).error);
          break;
        }
      }
    }
    buffer.flush();
    await result;
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
      `[generalTool] Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return {
      output: `# Error\n\nSorry, I encountered an error while processing your request:\n\n\`${error instanceof Error ? error.message : "Unknown error"}\`\n\nPlease try again or contact support if the issue persists.`,
    };
  }
};
