import { ipcMain } from "electron";
import { stream } from "../tools/stream.js";
import { ASK_IMAGE } from "../services/model.js";
import { cancelAllPendingConfirmations } from "../tools/orchestrator.js";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const activeStreams = new Map<string, AbortController>();

export function setupStreamHandlers() {
  ipcMain.handle(
    "stream-message-with-history",
    async (event, messages, config, apiKey) => {
      // Extract session ID from the last message (which is user message or processed user message)
      // We need to peek at the messages or return a session ID from stream function
      // But 'stream' expects 'messages'.
      // Let's rely on the fact that 'stream' extracts sessionId.
      // However, we need the sessionId BEFORE calling 'stream' to setup the controller map if possible,
      // OR we can pass a controller to 'stream' and let it use it.
      // Better: The renderer should theoretically send sessionId, but here we just have messages.
      // Let's assume the last message has the sessionId, as is common in this app.
      const lastMsg = messages[messages.length - 1];
      const sessionId = lastMsg?.sessionId;

      if (!sessionId) {
        return stream(event, messages, config, apiKey);
      }

      // cleanup previous controller for this session if exists
      if (activeStreams.has(sessionId)) {
        activeStreams.get(sessionId)?.abort();
        cancelAllPendingConfirmations();
        activeStreams.delete(sessionId);
      }

      const controller = new AbortController();
      activeStreams.set(sessionId, controller);

      try {
        return await stream(event, messages, config, apiKey, controller.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // Stream was cancelled
          return { text: "", error: "Cancelled by user" };
        }
        throw error;
      } finally {
        activeStreams.delete(sessionId);
      }
    }
  );

  ipcMain.handle("cancel-chat-stream", (_event, sessionId: string) => {
    if (activeStreams.has(sessionId)) {
      activeStreams.get(sessionId)?.abort();
      // Cancel all pending terminal command confirmations
      cancelAllPendingConfirmations();
      activeStreams.delete(sessionId);
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
      imageModelOverride?: string
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
    }
  );
}
