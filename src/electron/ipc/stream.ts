import { ipcMain } from "electron";
import { stream } from "../tools/stream.js";

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
        activeStreams.delete(sessionId);
      }

      const controller = new AbortController();
      activeStreams.set(sessionId, controller);

      try {
        return await stream(
          event,
          messages,
          config,
          apiKey,
          controller.signal
        );
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
      activeStreams.delete(sessionId);
      return true;
    }
    return false;
  });
}
