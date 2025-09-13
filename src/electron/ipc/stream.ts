import { ipcMain } from "electron";
import { CHANNELS } from "../strings.js";
import { stream } from "../tools/stream.js";

export function setupStreamHandlers() {
  ipcMain.handle(CHANNELS.STREAM_MESSAGE_WITH_HISTORY, stream);
}
