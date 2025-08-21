import log from "../../../common/log.js";
import { GoogleGenAI } from "@google/genai";

export const generalTool = async (context: string, event: any): Promise<{ output: string }> => {
  try {
    log.BG_BRIGHT_GREEN(JSON.stringify(context, null, 2));
    const prompt = `You are a helpful AI assistant that provides clear, well-formatted markdown responses.  Based on the following context/request, provide a nicely formatted markdown response`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const result = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        { role: "user", parts: [{ text: context }] },
      ],
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    let fullText = "";
    for await (const chunk of result) {
      const chunkText = chunk.text;
      if (chunkText) {
        event.sender.send("stream-chunk", {
          chunk: chunkText,
          type: "stream",
        });
        fullText += chunkText;
      }
    }

    // Streaming complete - no need to send final chunk

    return { output: fullText };
  } catch (error) {
    log.RED(`[generalTool] Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      output: `# Error\n\nSorry, I encountered an error while processing your request:\n\n\`${error instanceof Error ? error.message : "Unknown error"}\`\n\nPlease try again or contact support if the issue persists.`,
    };
  }
};
