import type { StreamChunk, ChatSessionRecord } from "../../common/types";
export interface ChatResponse {
  text: string;
  error?: string;
}

export type StreamCallback = (chunk: StreamChunk) => void;
export type ExecutionUpdateCallback = (data: {
  data: string;
  type: string;
}) => void;

function waitForElectronAPI(
  timeout = 5000,
): Promise<typeof window.electronAPI> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkAPI = () => {
      if (
        window.electronAPI &&
        typeof window.electronAPI.streamMessageWithHistory === "function"
      ) {
        resolve(window.electronAPI);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error("electronAPI not available after timeout"));
      } else {
        setTimeout(checkAPI, 100);
      }
    };

    checkAPI();
  });
}

export async function streamMessageWithHistory(
  messages: ChatSessionRecord[],
  onChunk: StreamCallback,
  config: any = {},
): Promise<ChatResponse> {
  try {
    const api = await waitForElectronAPI();

    api.onStreamChunk(onChunk);
    try {
      const response = await api.streamMessageWithHistory(messages, config);
      return response;
    } finally {
      api.removeStreamChunkListener();
    }
  } catch (error) {
    console.error("Error calling Gemini API through Electron:", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
