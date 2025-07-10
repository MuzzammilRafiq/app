import { ipcMain } from "electron";
import chalk from "chalk";
import { ToolHandler } from "../tools/toolHandler.js";
import { aiService } from "../services/gemini.js";

const ai = aiService.getAI();

const toolHandler = ToolHandler.getInstance();

export function setupGeminiHandlers() {
  ipcMain.handle("gemini:send-message", async (event, message: string) => {
    if (!aiService.isInitialized()) {
      return {
        text: "",
        error: "Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.",
      };
    }

    try {
      const { enhancedMessage } = await toolHandler.processMessage(message);

      console.log(chalk.blue("[Gemini] Enhanced message after tool calling:"));
      console.log(chalk.gray(enhancedMessage));

      // Send enhanced message to Gemini API with specific model and configuration
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Using flash model for faster responses
        contents: enhancedMessage,
        config: {
          thinkingConfig: {
            thinkingBudget: 0, // Disable thinking budget for faster response
          },
        },
      });

      return {
        text: response.text || "No response received",
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return {
        text: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });

  ipcMain.handle("gemini:send-message-with-history", async (event, messages: any[]) => {
    if (!aiService.isInitialized()) {
      return {
        text: "",
        error: "Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.",
      };
    }

    try {
      const lastUserMessage = messages.filter((msg) => msg.role === "user" && msg.content).pop();
      let processedMessages = [...messages];

      if (lastUserMessage) {
        const { enhancedMessage, toolResults } = await toolHandler.processMessage(lastUserMessage.content);

        console.log(chalk.blue("[Gemini History] Enhanced message after tool calling:"));
        console.log(chalk.gray(enhancedMessage));

        processedMessages = messages.map((msg) => {
          if (msg === lastUserMessage) {
            return {
              ...msg,
              content: enhancedMessage,
            };
          }
          return msg;
        });

        if (toolResults.length > 0) {
          console.log(`[Gemini] Applied ${toolResults.length} tool results to message`);
        }
      }

      const contents = processedMessages.map((msg) => {
        const parts = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.images && msg.images.length > 0) {
          for (const image of msg.images) {
            parts.push({
              inlineData: {
                mimeType: image.mimeType,
                data: image.data,
              },
            });
          }
        }

        return {
          role: msg.role === "user" ? "user" : "model",
          parts: parts,
        };
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      return {
        text: response.text || "No response received",
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return {
        text: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });

  ipcMain.handle("gemini:stream-message-with-history", async (event, messages: any[]) => {
    if (!aiService.isInitialized()) {
      return {
        text: "",
        error: "Gemini service not initialized. Please check your GEMINI_API_KEY environment variable.",
      };
    }

    try {
      const lastUserMessage = messages.filter((msg) => msg.role === "user" && msg.content).pop();
      let processedMessages = [...messages];

      if (lastUserMessage) {
        const { enhancedMessage, toolResults } = await toolHandler.processMessage(lastUserMessage.content);

        console.log(chalk.blue("[Gemini Stream] Enhanced message after tool calling:"));
        console.log(chalk.green(enhancedMessage));

        processedMessages = messages.map((msg) => {
          if (msg === lastUserMessage) {
            return {
              ...msg,
              content: enhancedMessage,
            };
          }
          return msg;
        });

        if (toolResults.length > 0) {
          console.log(`[Gemini Stream] Applied ${toolResults.length} tool results to message`);
        }
      }

      const contents = processedMessages.map((msg) => {
        const parts = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.images && msg.images.length > 0) {
          for (const image of msg.images) {
            parts.push({
              inlineData: {
                mimeType: image.mimeType,
                data: image.data,
              },
            });
          }
        }

        return {
          role: msg.role === "user" ? "user" : "model",
          parts: parts,
        };
      });

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
      console.error("Error calling Gemini API with streaming:", error);
      return {
        text: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });
}
