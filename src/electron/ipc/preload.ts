import { contextBridge, ipcRenderer } from "electron";
export interface StreamChunk {
  chunk: string;
  type: "stream" | "log" | "plan" | "source";
}
contextBridge.exposeInMainWorld("electronAPI", {
  streamMessageWithHistory: (messages: any[], config: any, apiKey: string) =>
    ipcRenderer.invoke("stream-message-with-history", messages, config, apiKey),
  cancelStream: (sessionId: string) =>
    ipcRenderer.invoke("cancel-chat-stream", sessionId),

  onStreamChunk: (callback: (data: StreamChunk) => void) => {
    ipcRenderer.on("stream-chunk", (event, data) => callback(data));
  },

  removeStreamChunkListener: () => {
    ipcRenderer.removeAllListeners("stream-chunk");
  },


  // Orchestrated multi-step workflow
  automationExecuteOrchestrated: (
    apiKey: string,
    userPrompt: string,
    imageModelOverride?: string,
    debug: boolean = false
  ) =>
    ipcRenderer.invoke(
      "automation:execute-orchestrated-workflow",
      apiKey,
      userPrompt,
      imageModelOverride,
      debug
    ),

  // Automation progress listener
  onAutomationStatus: (
    callback: (data: { step: string; message: string }) => void
  ) => {
    ipcRenderer.on("automation:status", (event, data) => callback(data));
  },
  removeAutomationStatusListener: () => {
    ipcRenderer.removeAllListeners("automation:status");
  },

  // Automation log listener
  onAutomationLog: (
    callback: (data: {
      type: "server" | "llm-request" | "llm-response" | "thinking" | "error";
      title: string;
      content: string;
    }) => void
  ) => {
    ipcRenderer.on("automation:log", (event, data) => callback(data));
  },
  removeAutomationLogListener: () => {
    ipcRenderer.removeAllListeners("automation:log");
  },

  // Automation image preview listener
  onAutomationImagePreview: (
    callback: (data: { title: string; imageBase64: string }) => void
  ) => {
    ipcRenderer.on("automation:image-preview", (event, data) => callback(data));
  },
  removeAutomationImagePreviewListener: () => {
    ipcRenderer.removeAllListeners("automation:image-preview");
  },

  //-------------------------image-embeddings-----------------------
  searchImagesByText: (query: string, limit: number = 10) =>
    ipcRenderer.invoke("image-embeddings:search-by-text", query, limit),
  deleteAllImageEmbeddings: () =>
    ipcRenderer.invoke("image-embeddings:delete-all"),

  selectFolder: () => ipcRenderer.invoke("image-embeddings:select-folder"),
  scanFolder: (folder: string) =>
    ipcRenderer.invoke("image-embeddings:scan-folder", folder),
  deleteFolder: (folder: string) =>
    ipcRenderer.invoke("image-embeddings:delete-folder", folder),

  readFileAsBuffer: (filePath: string) =>
    ipcRenderer.invoke("read-file-as-buffer", filePath),
  getConvertedHeicPath: (heicPath: string) =>
    ipcRenderer.invoke("get-converted-heic-path", heicPath),
  getHeicCacheStats: () => ipcRenderer.invoke("get-heic-cache-stats"),
  cleanupHeicCache: () => ipcRenderer.invoke("cleanup-heic-cache"),
  saveImageToMedia: (image: {
    data: string;
    mimeType: string;
    name?: string;
  }) => ipcRenderer.invoke("media:save-image", image),
  saveImageFromPathToMedia: (filePath: string) =>
    ipcRenderer.invoke("media:save-image-from-path", filePath),

  //-------------------------text-embeddings---------------------------
  searchTextsByText: (query: string, limit: number = 10) =>
    ipcRenderer.invoke("text-embeddings:search-by-text", query, limit),
  deleteAllTextEmbeddings: () =>
    ipcRenderer.invoke("text-embeddings:delete-all"),
  selectTextFolder: () => ipcRenderer.invoke("text-embeddings:select-folder"),
  scanTextFolder: (folder: string) =>
    ipcRenderer.invoke("text-embeddings:scan-folder", folder),
  deleteTextFolder: (folder: string) =>
    ipcRenderer.invoke("text-embeddings:delete-folder", folder),

  //-------------------------database service APIs-----------------------------
  dbCreateSession: (title: string, id?: string) =>
    ipcRenderer.invoke("db:create-session", title, id),
  dbGetSessions: () => ipcRenderer.invoke("db:get-sessions"),
  dbGetSession: (id: string) => ipcRenderer.invoke("db:get-session", id),
  dbUpdateSessionTitle: (id: string, title: string) =>
    ipcRenderer.invoke("db:update-session-title", id, title),
  dbTouchSession: (id: string, timestamp: number) =>
    ipcRenderer.invoke("db:touch-session", id, timestamp),
  dbDeleteSession: (id: string) => ipcRenderer.invoke("db:delete-session", id),

  dbAddChatMessage: (message: any) =>
    ipcRenderer.invoke("db:add-chat-message", message),
  dbGetChatMessages: (sessionId: string) =>
    ipcRenderer.invoke("db:get-chat-messages", sessionId),
  dbDeleteChatMessage: (id: string) =>
    ipcRenderer.invoke("db:delete-chat-message", id),
  dbDeleteChatMessagesBySession: (sessionId: string) =>
    ipcRenderer.invoke("db:delete-chat-messages-by-session", sessionId),
  dbGetAllSessionsWithMessages: (limit: number) =>
    ipcRenderer.invoke("db:get-all-sessions-with-messages", limit),

  // Plan steps APIs
  dbUpsertPlanSteps: (sessionId: string, planHash: string, steps: any[]) =>
    ipcRenderer.invoke("db:upsert-plan-steps", sessionId, planHash, steps),
  dbMarkPlanStepDone: (
    sessionId: string,
    planHash: string,
    stepNumber: number
  ) =>
    ipcRenderer.invoke(
      "db:mark-plan-step-done",
      sessionId,
      planHash,
      stepNumber
    ),
  dbGetPlanSteps: (sessionId: string, planHash: string) =>
    ipcRenderer.invoke("db:get-plan-steps", sessionId, planHash),

  // RAG folders APIs
  dbGetRagFolders: (type: "image" | "text") =>
    ipcRenderer.invoke("db:get-rag-folders", type),
  dbAddRagFolder: (
    folderPath: string,
    type: "image" | "text",
    lastScannedAt?: number
  ) => ipcRenderer.invoke("db:add-rag-folder", folderPath, type, lastScannedAt),
  dbUpdateRagFolderScanTime: (folderPath: string, lastScannedAt: number) =>
    ipcRenderer.invoke("db:update-rag-folder-scan-time", folderPath, lastScannedAt),
  dbDeleteRagFolder: (folderPath: string) =>
    ipcRenderer.invoke("db:delete-rag-folder", folderPath),

  //-------------------------openrouter---------------------------
  getOpenRouterModels: (apiKey: string) =>
    ipcRenderer.invoke("get-openrouter-models", apiKey),

  //-------------------------window controls---------------------------
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  windowIsMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  windowGetPlatform: () => ipcRenderer.invoke("window:get-platform"),
  windowHide: () => ipcRenderer.invoke("window:hide"),
  windowShow: () => ipcRenderer.invoke("window:show"),

  //-------------------------terminal command confirmation---------------------------
  onCommandConfirmation: (
    callback: (data: {
      command: string;
      requestId: string;
      cwd: string;
    }) => void
  ) => {
    ipcRenderer.on("terminal:request-confirmation", (event, data) =>
      callback(data)
    );
  },
  respondToCommandConfirmation: (requestId: string, allowed: boolean) =>
    ipcRenderer.invoke("terminal:confirmation-response", requestId, allowed),
  removeCommandConfirmationListener: () => {
    ipcRenderer.removeAllListeners("terminal:request-confirmation");
  },
});
