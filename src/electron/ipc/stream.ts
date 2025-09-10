import { ipcMain } from "electron";
import { stream } from "../tools/stream.js";
import { EventChannels } from "../../common/constants.js";
export function setupStreamHandlers() {
  ipcMain.handle(EventChannels.STREAM_MESSAGE_WITH_HISTORY, stream);
}
