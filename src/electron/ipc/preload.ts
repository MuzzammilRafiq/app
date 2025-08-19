import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  streamMessageWithHistory: (messages: any[]) => ipcRenderer.invoke("stream-message-with-history", messages),
  onExecutionUpdate: (callback: (data: { data: string; type: string }) => void) => {
    ipcRenderer.on("stream:execution-trace", (event, data) => callback(data));
  },
  removeExecutionUpdateListener: () => {
    ipcRenderer.removeAllListeners("stream:execution-trace");
  },

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

  addImageFolder: (folderPath: string) => ipcRenderer.invoke("image-embeddings:scan-folder", folderPath),

  searchImagesByText: (query: string, limit: number = 10) =>
    ipcRenderer.invoke("image-embeddings:search-by-text", query, limit),
  deleteAllImageEmbeddings: () => ipcRenderer.invoke("image-embeddings:delete-all"),

  selectFolder: () => ipcRenderer.invoke("image-embeddings:select-folder"),
  scanFolder: (folder: string) => ipcRenderer.invoke("image-embeddings:scan-folder", folder),

  readFileAsBuffer: (filePath: string) => ipcRenderer.invoke("read-file-as-buffer", filePath),
  getConvertedHeicPath: (heicPath: string) => ipcRenderer.invoke("get-converted-heic-path", heicPath),
  getHeicCacheStats: () => ipcRenderer.invoke("get-heic-cache-stats"),
  cleanupHeicCache: () => ipcRenderer.invoke("cleanup-heic-cache"),
});
