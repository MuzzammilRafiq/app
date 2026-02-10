import { ipcMain } from "electron";
import { LOG } from "../utils/logging.js";

const TAG = "transcription";
const URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

type StartListeningPayload = {
  vad_threshold?: number;
  pre_roll_seconds?: number;
  silence_timeout?: number;
  max_chunk_duration?: number;
};

type StartListeningData = {
  status: string;
  session_id: string;
  message: string;
};

type StopListeningData = {
  status: string;
  session_id: string;
  transcriptions: Array<{
    text: string;
    timestamp: string;
    is_final: boolean;
  }>;
};

async function parseError(response: Response): Promise<string> {
  try {
    const json = await response.json();
    if (typeof json?.detail === "string") {
      return json.detail;
    }
    return `Server error: ${response.status}`;
  } catch {
    return `Server error: ${response.status}`;
  }
}

export function setupTranscriptionHandlers() {
  ipcMain.handle(
    "transcription:start-listening",
    async (_event, payload?: StartListeningPayload) => {
      try {
        const response = await fetch(`${URL}/transcription/start-listening`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload ?? {}),
        });

        if (!response.ok) {
          throw new Error(await parseError(response));
        }

        const data: StartListeningData = await response.json();
        return {
          success: true,
          error: null,
          data,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        LOG(TAG).ERROR("start-listening failed:", errorMessage);
        return {
          success: false,
          error: errorMessage,
          data: null,
        };
      }
    },
  );

  ipcMain.handle("transcription:stop-listening", async () => {
    try {
      const response = await fetch(`${URL}/transcription/stop-listening`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const data: StopListeningData = await response.json();
      return {
        success: true,
        error: null,
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      LOG(TAG).ERROR("stop-listening failed:", errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null,
      };
    }
  });
}
