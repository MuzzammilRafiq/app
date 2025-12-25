import { ASK_TEXT } from "../../services/llm.js";
import { LOG, JSON_PRINT } from "../../utils/logging.js";

const TAG = "general";
export const generalTool = async (
  context: string,
  event: any,
  apiKey: string,
): Promise<{ output: string }> => {
  try {
    LOG(TAG).INFO(JSON_PRINT(context));
    const system =
      "You are a helpful AI assistant. Provide a clear, concise, well-formatted markdown response. Do not wrap the output in ```markdown```.";
    const response = ASK_TEXT(apiKey, [
      { role: "system", content: system },
      { role: "user", content: context },
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
