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
      if (window.electronAPI && typeof window.electronAPI.streamMessageWithHistory === "function") {
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
  messages: ChatMessage[],
  onChunk: StreamCallback
): Promise<ChatResponse> {
  try {
    const api = await waitForElectronAPI();

    api.onStreamChunk(onChunk);
    try {
      // Start streaming
      const response = await api.streamMessageWithHistory(messages);
      console.log("ppp2");
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

export async function convertHeicToJpeg(file: File): Promise<File> {
  // Dynamically import heic2any to avoid build issues
  const heic2any = (await import("heic2any")).default;

  const convertedBlob = (await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.8,
  })) as Blob;

  // Create a new File object from the converted blob
  return new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

export async function fileToBase64(file: File): Promise<string> {
  let processedFile = file;

  // Convert HEIC files to JPEG first
  if (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  ) {
    try {
      processedFile = await convertHeicToJpeg(file);
    } catch (error) {
      console.error("Error converting HEIC file:", error);
      throw new Error("Failed to convert HEIC image");
    }
  }

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
    reader.readAsDataURL(processedFile);
  });
}

export function validateImageFile(file: File): {
  isValid: boolean;
  error?: string;
} {
  const maxSize = 20 * 1024 * 1024;
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

  if (file.size > maxSize) {
    return { isValid: false, error: "Image file size must be less than 20MB" };
  }

  if (!allowedTypes.includes(file.type)) {
    // Check file extension for HEIC files (sometimes MIME type isn't detected correctly)
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".heic") || fileName.endsWith(".heif")) {
      return { isValid: true };
    }

    return {
      isValid: false,
      error: "Only JPEG, PNG, WebP, GIF, and HEIC images are supported",
    };
  }

  return { isValid: true };
}
