import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  streamMessageWithHistory: (messages: any[]) => ipcRenderer.invoke("stream-message-with-history", messages),

  onStreamChunk: (callback: (data: { chunk: string; isComplete: boolean; fullText?: string }) => void) => {
    ipcRenderer.on("gemini:stream-chunk", (event, data) => callback(data));
  },

  removeStreamChunkListener: () => {
    ipcRenderer.removeAllListeners("gemini:stream-chunk");
  },

  captureScreenshot: () => ipcRenderer.invoke("screenshot:capture"),

  onGlobalScreenshotTrigger: (callback: () => void) => {
    ipcRenderer.on("global-screenshot-trigger", () => callback());
  },

  removeGlobalScreenshotListener: () => {
    ipcRenderer.removeAllListeners("global-screenshot-trigger");
  },
});
