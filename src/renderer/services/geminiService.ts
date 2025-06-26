export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  isError?: boolean;
  images?: ImageData[];
}

export interface ImageData {
  data: string;
  mimeType: string;
  name?: string;
}

export interface ChatResponse {
  text: string;
  error?: string;
}

export interface StreamChunk {
  chunk: string;
  isComplete: boolean;
  fullText?: string;
}

export type StreamCallback = (chunk: StreamChunk) => void;

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

export async function streamMessageWithHistory(
  messages: ChatMessage[],
  onChunk: StreamCallback
): Promise<ChatResponse> {
  try {
    const api = await waitForElectronAPI();

    // Set up stream listener
    api.onStreamChunk(onChunk);

    try {
      // Start streaming
      const response = await api.streamMessageWithHistory(messages);
      return response;
    } finally {
      // Clean up listener - this will always execute, even if an error occurs
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

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = 20 * 1024 * 1024;
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

  if (file.size > maxSize) {
    return { isValid: false, error: "Image file size must be less than 20MB" };
  }

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: "Only JPEG, PNG, WebP, and GIF images are supported" };
  }

  return { isValid: true };
}
