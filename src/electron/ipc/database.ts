import { ipcMain } from "electron";
import dbService from "../services/database.js";

export function setupDatabaseHandlers() {
  // Sessions
  ipcMain.handle("db:create-session", async (_event, title: string, id?: string) => {
    return dbService.createSession(title, id);
  });

  ipcMain.handle("db:get-sessions", async () => {
    return dbService.getSessions();
  });

  ipcMain.handle("db:get-session", async (_event, id: string) => {
    return dbService.getSessionById(id);
  });

  ipcMain.handle("db:update-session-title", async (_event, id: string, title: string) => {
    return dbService.updateSessionTitle(id, title);
  });

  ipcMain.handle("db:touch-session", async (_event, id: string, timestamp: number) => {
    return dbService.touchSession(id, timestamp);
  });

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

  ipcMain.handle("db:delete-chat-messages-by-session", async (_event, sessionId: string) => {
    return dbService.deleteChatMessagesBySession(sessionId);
  });
  ipcMain.handle("db:get-all-sessions-with-messages", async (_event, limit: number) => {
    return dbService.getAllSessionsWithMessages(limit);
  });
}
