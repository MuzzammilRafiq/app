import { ipcMain } from "electron";
import type {
  MeetChatProcessConfig,
  MeetChatProcessRequest,
} from "../../common/types.js";
import { processMeetChatTranscript } from "../services/meet-chat.js";

export function setupMeetChatHandlers() {
  ipcMain.handle(
    "meet-chat:process-transcript",
    async (
      _event,
      request: MeetChatProcessRequest,
      apiKey: string,
      config?: MeetChatProcessConfig,
    ) => {
      return processMeetChatTranscript(apiKey, request, config);
    },
  );
}