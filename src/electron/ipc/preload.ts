import { contextBridge, ipcRenderer } from "electron";
export interface StreamChunk {
  chunk: string;
  type: "stream" | "log" | "plan";
}
contextBridge.exposeInMainWorld("electronAPI", {
  streamMessageWithHistory: (messages: any[]) => ipcRenderer.invoke("stream-message-with-history", messages),
  onStreamChunk: (callback: (data: StreamChunk) => void) => {
    ipcRenderer.on("stream-chunk", (event, data) => callback(data));
  },

  removeStreamChunkListener: () => {
    ipcRenderer.removeAllListeners("stream-chunk");
  },

  //image related stuff
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
