import { contextBridge, ipcRenderer } from "electron";
import { type StreamChunk } from "../../common/types.js";
import { CHANNELS } from "../strings.js";
contextBridge.exposeInMainWorld("electronAPI", {
  streamMessageWithHistory: (messages: any[], config: any) =>
    ipcRenderer.invoke(CHANNELS.STREAM_MESSAGE_WITH_HISTORY, messages, config),
  onStreamChunk: (callback: (data: StreamChunk) => void) => {
    ipcRenderer.on(CHANNELS.STREAM_CHUNK, (event, data) => callback(data));
  },

  removeStreamChunkListener: () => {
    ipcRenderer.removeAllListeners(CHANNELS.STREAM_CHUNK);
  },

  //-------------------------image-embeddings-----------------------
  searchImagesByText: (query: string, limit: number = 10) =>
    ipcRenderer.invoke(CHANNELS.IMAGE_EMBEDDINGS_SEARCH_BY_TEXT, query, limit),
  deleteAllImageEmbeddings: () => ipcRenderer.invoke(CHANNELS.IMAGE_EMBEDDINGS_DELETE_ALL),

  selectFolder: () => ipcRenderer.invoke(CHANNELS.IMAGE_EMBEDDINGS_SELECT_FOLDER),
  scanFolder: (folder: string) => ipcRenderer.invoke(CHANNELS.IMAGE_EMBEDDINGS_SCAN_FOLDER, folder),
  deleteFolder: (folder: string) => ipcRenderer.invoke(CHANNELS.IMAGE_EMBEDDINGS_DELETE_FOLDER, folder),

  readFileAsBuffer: (filePath: string) => ipcRenderer.invoke(CHANNELS.READ_FILE_AS_BUFFER, filePath),
  getConvertedHeicPath: (heicPath: string) => ipcRenderer.invoke(CHANNELS.GET_CONVERTED_HEIC_PATH, heicPath),
  getHeicCacheStats: () => ipcRenderer.invoke(CHANNELS.GET_HEIC_CACHE_STATS),
  cleanupHeicCache: () => ipcRenderer.invoke(CHANNELS.CLEANUP_HEIC_CACHE),
  saveImageToMedia: (image: { data: string; mimeType: string; name?: string }) =>
    ipcRenderer.invoke(CHANNELS.MEDIA_SAVE_IMAGE, image),

  //-------------------------text-embeddings---------------------------
  searchTextsByText: (query: string, limit: number = 10) =>
    ipcRenderer.invoke(CHANNELS.TEXT_EMBEDDINGS_SEARCH_BY_TEXT, query, limit),
  deleteAllTextEmbeddings: () => ipcRenderer.invoke(CHANNELS.TEXT_EMBEDDINGS_DELETE_ALL),
  selectTextFolder: () => ipcRenderer.invoke(CHANNELS.TEXT_EMBEDDINGS_SELECT_FOLDER),
  scanTextFolder: (folder: string) => ipcRenderer.invoke(CHANNELS.TEXT_EMBEDDINGS_SCAN_FOLDER, folder),
  deleteTextFolder: (folder: string) => ipcRenderer.invoke(CHANNELS.TEXT_EMBEDDINGS_DELETE_FOLDER, folder),

  //-------------------------database service APIs-----------------------------
  dbCreateSession: (title: string, id?: string) => ipcRenderer.invoke(CHANNELS.DB_CREATE_SESSION, title, id),
  dbGetSessions: () => ipcRenderer.invoke(CHANNELS.DB_GET_SESSIONS),
  dbGetSession: (id: string) => ipcRenderer.invoke(CHANNELS.DB_GET_SESSION, id),
  dbUpdateSessionTitle: (id: string, title: string) => ipcRenderer.invoke(CHANNELS.DB_UPDATE_SESSION_TITLE, id, title),
  dbTouchSession: (id: string, timestamp: number) => ipcRenderer.invoke(CHANNELS.DB_TOUCH_SESSION, id, timestamp),
  dbDeleteSession: (id: string) => ipcRenderer.invoke(CHANNELS.DB_DELETE_SESSION, id),

  dbAddChatMessage: (message: any) => ipcRenderer.invoke(CHANNELS.DB_ADD_CHAT_MESSAGE, message),
  dbGetChatMessages: (sessionId: string) => ipcRenderer.invoke(CHANNELS.DB_GET_CHAT_MESSAGES, sessionId),
  dbDeleteChatMessage: (id: string) => ipcRenderer.invoke(CHANNELS.DB_DELETE_CHAT_MESSAGE, id),
  dbDeleteChatMessagesBySession: (sessionId: string) =>
    ipcRenderer.invoke(CHANNELS.DB_DELETE_CHAT_MESSAGES_BY_SESSION, sessionId),
  dbGetAllSessionsWithMessages: (limit: number) =>
    ipcRenderer.invoke(CHANNELS.DB_GET_ALL_SESSIONS_WITH_MESSAGES, limit),
});
