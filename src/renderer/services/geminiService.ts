export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  isError?: boolean;
}

export interface ChatResponse {
  text: string;
  error?: string;
}

function waitForElectronAPI(timeout = 5000): Promise<typeof window.electronAPI> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkAPI = () => {
      if (window.electronAPI && typeof window.electronAPI.sendMessageWithHistory === "function") {
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

export async function sendMessage(message: string): Promise<ChatResponse> {
  try {
    const api = await waitForElectronAPI();

    const response = await api.sendMessage(message);
    return response;
  } catch (error) {
    console.error("Error calling Gemini API through Electron:", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function sendMessageWithHistory(messages: ChatMessage[]): Promise<ChatResponse> {
  try {
    const api = await waitForElectronAPI();

    const response = await api.sendMessageWithHistory(messages);
    return response;
  } catch (error) {
    console.error("Error calling Gemini API through Electron:", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
