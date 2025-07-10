import { ipcMain } from "electron";
// import { aiService } from "../services/gemini.js";
import chalk from "chalk";
import { ToolHandler } from "../tools/toolHandler.js";
import { GoogleGenAI } from "@google/genai";

const toolHandler = ToolHandler.getInstance();

export function setupStreamHandlers() {
  ipcMain.handle("stream-message-with-history", async (event, messages: any[]) => {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      let processedMessages = [...messages];
      let lastUserMessage = messages.filter((msg) => msg.role === "user" && msg.content).pop();
      if (lastUserMessage) {
        if (lastUserMessage.images && lastUserMessage.images.length > 0) {
          const { data: imageData, mimeType: imageMimeType } = lastUserMessage.images[0];

          const imageBase64 = Buffer.from(imageData, "base64").toString("base64");
          console.log(chalk.green("generating image description"));
          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                inlineData: {
                  mimeType: imageMimeType,
                  data: imageBase64,
                },
              },
              { text: "Describe this image and extract text" },
            ],
          });
          lastUserMessage = {
            id: lastUserMessage.id,
            content: `query: "${lastUserMessage.content}"\n\nimage description extracted from the image in the query by a tool: <description>${result.text}</description>`,
            role: "user",
            timestamp: lastUserMessage.timestamp,
          };
        }
        const { enhancedMessage, toolResults } = await toolHandler.processMessage(lastUserMessage.content);
        processedMessages = processedMessages.slice(0, processedMessages.length - 1);
        processedMessages.push({ ...lastUserMessage, content: enhancedMessage });
        if (toolResults.length > 0) {
          console.log(`[Gemini Stream] Applied ${toolResults.length} tool results to message`);
        }
      }

      const contents = processedMessages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      const result = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents,
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
          fullText += chunkText;
          event.sender.send("gemini:stream-chunk", {
            chunk: chunkText,
            isComplete: false,
          });
        }
      }

      event.sender.send("gemini:stream-chunk", {
        chunk: "",
        isComplete: true,
        fullText,
      });

      return {
        text: fullText,
      };
    } catch (error) {
      console.log(chalk.red("Error calling Gemini API with streaming:", error));
      return {
        text: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });
}
