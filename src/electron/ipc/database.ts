import { ipcMain } from "electron";
import dbService from "../services/database.js";
import { EventChannels } from "../../common/constants.js";

export function setupDatabaseHandlers() {
  // Sessions
  ipcMain.handle(EventChannels.DB_CREATE_SESSION, async (_event, title: string, id?: string) => {
    return dbService.createSession(title, id);
  });

  ipcMain.handle(EventChannels.DB_GET_SESSIONS, async () => {
    return dbService.getSessions();
  });

  ipcMain.handle(EventChannels.DB_GET_SESSION, async (_event, id: string) => {
    return dbService.getSessionById(id);
  });

  ipcMain.handle(EventChannels.DB_UPDATE_SESSION_TITLE, async (_event, id: string, title: string) => {
    return dbService.updateSessionTitle(id, title);
  });

  ipcMain.handle(EventChannels.DB_TOUCH_SESSION, async (_event, id: string, timestamp: number) => {
    return dbService.touchSession(id, timestamp);
  });

  ipcMain.handle(EventChannels.DB_DELETE_SESSION, async (_event, id: string) => {
    return dbService.deleteSession(id);
  });

  // Chat messages
  ipcMain.handle(EventChannels.DB_ADD_CHAT_MESSAGE, async (_event, message: any) => {
    return dbService.addChatMessage(message);
  });

  ipcMain.handle(EventChannels.DB_GET_CHAT_MESSAGES, async (_event, sessionId: string) => {
    return dbService.getChatMessagesBySession(sessionId);
  });

  ipcMain.handle(EventChannels.DB_DELETE_CHAT_MESSAGE, async (_event, id: string) => {
    return dbService.deleteChatMessage(id);
  });

  ipcMain.handle(EventChannels.DB_DELETE_CHAT_MESSAGES_BY_SESSION, async (_event, sessionId: string) => {
    return dbService.deleteChatMessagesBySession(sessionId);
  });
  ipcMain.handle(EventChannels.DB_GET_ALL_SESSIONS_WITH_MESSAGES, async (_event, limit: number) => {
    return dbService.getAllSessionsWithMessages(limit);
  });
}
