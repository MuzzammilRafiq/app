import { ipcMain } from "electron";
import dbService from "../services/database.js";

export function setupDatabaseHandlers() {
  // Sessions
  ipcMain.handle(
    "db:create-session",
    async (_event, title: string, id?: string) => {
      return dbService.createSession(title, id);
    },
  );

  ipcMain.handle("db:get-sessions", async () => {
    return dbService.getSessions();
  });

  ipcMain.handle("db:get-session", async (_event, id: string) => {
    return dbService.getSessionById(id);
  });

  ipcMain.handle(
    "db:update-session-title",
    async (_event, id: string, title: string) => {
      return dbService.updateSessionTitle(id, title);
    },
  );

  ipcMain.handle(
    "db:touch-session",
    async (_event, id: string, timestamp: number) => {
      return dbService.touchSession(id, timestamp);
    },
  );

  ipcMain.handle("db:delete-session", async (_event, id: string) => {
    return dbService.deleteSession(id);
  });

  // Chat messages
  ipcMain.handle("db:add-chat-message", async (_event, message: any) => {
    return dbService.addChatMessage(message);
  });

  ipcMain.handle("db:get-chat-messages", async (_event, sessionId: string) => {
    return dbService.getChatMessagesBySession(sessionId);
  });

  ipcMain.handle("db:delete-chat-message", async (_event, id: string) => {
    return dbService.deleteChatMessage(id);
  });

  ipcMain.handle(
    "db:delete-chat-messages-by-session",
    async (_event, sessionId: string) => {
      return dbService.deleteChatMessagesBySession(sessionId);
    },
  );
  ipcMain.handle(
    "db:get-all-sessions-with-messages",
    async (_event, limit: number) => {
      return dbService.getAllSessionsWithMessages(limit);
    },
  );

  // Plan steps
  ipcMain.handle(
    "db:upsert-plan-steps",
    async (_event, sessionId: string, planHash: string, steps: any[]) => {
      return dbService.upsertPlanSteps(sessionId, planHash, steps);
    },
  );
  ipcMain.handle(
    "db:mark-plan-step-done",
    async (_event, sessionId: string, planHash: string, stepNumber: number) => {
      return dbService.markPlanStepDone(sessionId, planHash, stepNumber);
    },
  );
  ipcMain.handle(
    "db:get-plan-steps",
    async (_event, sessionId: string, planHash: string) => {
      return dbService.getPlanSteps(sessionId, planHash);
    },
  );

  // RAG folders
  ipcMain.handle(
    "db:get-rag-folders",
    async (_event, type: "image" | "text") => {
      return dbService.getRagFolders(type);
    },
  );
  ipcMain.handle(
    "db:add-rag-folder",
    async (
      _event,
      folderPath: string,
      type: "image" | "text",
      lastScannedAt?: number,
    ) => {
      return dbService.addRagFolder(folderPath, type, lastScannedAt);
    },
  );
  ipcMain.handle(
    "db:update-rag-folder-scan-time",
    async (_event, folderPath: string, lastScannedAt: number) => {
      return dbService.updateRagFolderScanTime(folderPath, lastScannedAt);
    },
  );
  ipcMain.handle("db:delete-rag-folder", async (_event, folderPath: string) => {
    return dbService.deleteRagFolder(folderPath);
  });

  // Vision sessions
  ipcMain.handle(
    "db:create-vision-session",
    async (_event, goal: string, id?: string) => {
      return dbService.createVisionSession(goal, id);
    },
  );

  ipcMain.handle("db:get-vision-sessions", async () => {
    return dbService.getVisionSessions();
  });

  ipcMain.handle("db:get-vision-session", async (_event, id: string) => {
    return dbService.getVisionSessionById(id);
  });

  ipcMain.handle(
    "db:update-vision-session-status",
    async (_event, id: string, status: string) => {
      return dbService.updateVisionSessionStatus(id, status as any);
    },
  );

  ipcMain.handle("db:delete-vision-session", async (_event, id: string) => {
    return dbService.deleteVisionSession(id);
  });

  // Vision logs
  ipcMain.handle("db:add-vision-log", async (_event, log: any) => {
    return dbService.addVisionLog(log);
  });

  ipcMain.handle("db:get-vision-logs", async (_event, sessionId: string) => {
    return dbService.getVisionLogsBySession(sessionId);
  });

  ipcMain.handle(
    "db:get-vision-sessions-with-logs",
    async (_event, limit: number) => {
      return dbService.getVisionSessionsWithLogs(limit);
    },
  );
}
