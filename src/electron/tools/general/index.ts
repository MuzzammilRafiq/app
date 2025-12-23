import log from "../../../common/log.js";
import { ASK_TEXT } from "../../services/llm.js";

export const generalTool = async (
  context: string,
  event: any,
  apiKey: string
): Promise<{ output: string }> => {
  try {
    log.BG_BRIGHT_GREEN(JSON.stringify(context, null, 2));
    const prompt =
      "You are a helpful AI assistant that provides clear, well-formatted markdown responses.  Based on the following context/request, provide a nicely formatted markdown response dont add ```markdown ``` around the response it is redundant";

    const response = ASK_TEXT(apiKey, [{ role: "user", content: prompt }]);
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
    log.BG_BLUE(c);
    // Streaming complete - no need to send final chunk

    return { output: c };
  } catch (error) {
    log.RED(
      `[generalTool] Error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return {
      output: `# Error\n\nSorry, I encountered an error while processing your request:\n\n\`${error instanceof Error ? error.message : "Unknown error"}\`\n\nPlease try again or contact support if the issue persists.`,
    };
  }
};
