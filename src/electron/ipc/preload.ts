import { contextBridge, ipcRenderer } from "electron";
export interface StreamChunk {
  chunk: string;
  type: "stream" | "log" | "plan" | "source";
}
contextBridge.exposeInMainWorld("electronAPI", {
  streamMessageWithHistory: (messages: any[], config: any) =>
    ipcRenderer.invoke("stream-message-with-history", messages, config),
  onStreamChunk: (callback: (data: StreamChunk) => void) => {
    ipcRenderer.on("stream-chunk", (event, data) => callback(data));
  },

  removeStreamChunkListener: () => {
    ipcRenderer.removeAllListeners("stream-chunk");
  },

  //-------------------------image-embeddings-----------------------
  searchImagesByText: (query: string, limit: number = 10) =>
    ipcRenderer.invoke("image-embeddings:search-by-text", query, limit),
  deleteAllImageEmbeddings: () => ipcRenderer.invoke("image-embeddings:delete-all"),

  selectFolder: () => ipcRenderer.invoke("image-embeddings:select-folder"),
  scanFolder: (folder: string) => ipcRenderer.invoke("image-embeddings:scan-folder", folder),
  deleteFolder: (folder: string) => ipcRenderer.invoke("image-embeddings:delete-folder", folder),

  readFileAsBuffer: (filePath: string) => ipcRenderer.invoke("read-file-as-buffer", filePath),
  getConvertedHeicPath: (heicPath: string) => ipcRenderer.invoke("get-converted-heic-path", heicPath),
  getHeicCacheStats: () => ipcRenderer.invoke("get-heic-cache-stats"),
  cleanupHeicCache: () => ipcRenderer.invoke("cleanup-heic-cache"),
  saveImageToMedia: (image: { data: string; mimeType: string; name?: string }) =>
    ipcRenderer.invoke("media:save-image", image),
  saveImageFromPathToMedia: (filePath: string) => ipcRenderer.invoke("media:save-image-from-path", filePath),

  //-------------------------text-embeddings---------------------------
  searchTextsByText: (query: string, limit: number = 10) =>
    ipcRenderer.invoke("text-embeddings:search-by-text", query, limit),
  deleteAllTextEmbeddings: () => ipcRenderer.invoke("text-embeddings:delete-all"),
  selectTextFolder: () => ipcRenderer.invoke("text-embeddings:select-folder"),
  scanTextFolder: (folder: string) => ipcRenderer.invoke("text-embeddings:scan-folder", folder),
  deleteTextFolder: (folder: string) => ipcRenderer.invoke("text-embeddings:delete-folder", folder),

  //-------------------------database service APIs-----------------------------
  dbCreateSession: (title: string, id?: string) => ipcRenderer.invoke("db:create-session", title, id),
  dbGetSessions: () => ipcRenderer.invoke("db:get-sessions"),
  dbGetSession: (id: string) => ipcRenderer.invoke("db:get-session", id),
  dbUpdateSessionTitle: (id: string, title: string) => ipcRenderer.invoke("db:update-session-title", id, title),
  dbTouchSession: (id: string, timestamp: number) => ipcRenderer.invoke("db:touch-session", id, timestamp),
  dbDeleteSession: (id: string) => ipcRenderer.invoke("db:delete-session", id),

  dbAddChatMessage: (message: any) => ipcRenderer.invoke("db:add-chat-message", message),
  dbGetChatMessages: (sessionId: string) => ipcRenderer.invoke("db:get-chat-messages", sessionId),
  dbDeleteChatMessage: (id: string) => ipcRenderer.invoke("db:delete-chat-message", id),
  dbDeleteChatMessagesBySession: (sessionId: string) =>
    ipcRenderer.invoke("db:delete-chat-messages-by-session", sessionId),
  dbGetAllSessionsWithMessages: (limit: number) => ipcRenderer.invoke("db:get-all-sessions-with-messages", limit),
});
