import { ipcMain } from "electron";
import { stream } from "../tools/stream.js";
import { ASK_IMAGE } from "../services/model.js";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { cancelAllPendingConfirmations } from "../tools/terminal/index.js";

type ActiveStream = {
  sessionId: string;
  controller: AbortController;
} | null;

const activeStream: { current: ActiveStream } = { current: null };

export function setupStreamHandlers() {
  ipcMain.handle(
    "stream-message-with-history",
    async (event, messages, config, apiKey) => {
      if (activeStream.current) {
        return { text: "", error: "Chat stream already in progress" };
      }

      const lastMsg = messages[messages.length - 1];
      const sessionId = lastMsg?.sessionId;
      const streamSessionId = sessionId ?? "unknown";

      const controller = new AbortController();
      activeStream.current = { sessionId: streamSessionId, controller };

      try {
        return await stream(event, messages, config, apiKey, controller.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // Stream was cancelled
          return { text: "", error: "Cancelled by user" };
        }
        throw error;
      } finally {
        if (activeStream.current?.sessionId === streamSessionId) {
          activeStream.current = null;
        }
      }
    },
  );

  ipcMain.handle("cancel-chat-stream", () => {
    if (activeStream.current) {
      activeStream.current.controller.abort();
      // Cancel all pending terminal command confirmations
      cancelAllPendingConfirmations();
      activeStream.current = null;
      return true;
    }
    return false;
  });

  // Vision click: analyze image with grid to find target cell
  ipcMain.handle(
    "vision-click-analyze",
    async (
      _event,
      apiKey: string,
      imageBase64: string,
      prompt: string,
      imageModelOverride?: string,
    ) => {
      let tempFilePath: string | null = null;
      try {
        // Save base64 to temp file for ASK_IMAGE
        const tempDir = os.tmpdir();
        tempFilePath = path.join(tempDir, `vision-click-${Date.now()}.png`);
        const buffer = Buffer.from(imageBase64, "base64");
        await fs.writeFile(tempFilePath, buffer);

        // Use ASK_IMAGE and collect all chunks
        let response = "";
        for await (const chunk of ASK_IMAGE(apiKey, prompt, [tempFilePath], {
          overrideModel: imageModelOverride,
        })) {
          if (chunk.content) {
            response += chunk.content;
          }
        }

        return { success: true, response };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      } finally {
        // Cleanup temp file
        if (tempFilePath) {
          try {
            await fs.unlink(tempFilePath);
          } catch {}
        }
      }
    },
  );
}
