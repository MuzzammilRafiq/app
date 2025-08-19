import { ipcMain } from "electron";
import { stream } from "../tools/stream.js";

export function setupStreamHandlers() {
  ipcMain.handle("stream-message-with-history", stream);
}
