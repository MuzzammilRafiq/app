import { ipcMain } from "electron";
import { Channels } from "../../common/types.js";
import { stream } from "../tools/stream.js";

export function setupStreamHandlers() {
  ipcMain.handle(Channels.STREAM_MESSAGE_WITH_HISTORY, stream);
}
