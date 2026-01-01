import toast from "react-hot-toast";
import type { ChatMessageRecord } from "../../../common/types";
import type { ImageData } from "../../services/imageUtils";

export interface ChatSession {
  id: string;
  messages: ChatMessageRecord[];
}

export interface MessageHandlers {
  addMessage: (message: ChatMessageRecord, session: any) => void;
  createNewSession: (session: any) => void;
}

export interface StreamingOptions {
  rag: boolean;
}

/**
 * Handles image persistence to the media folder
 */
export async function handleImagePersistence(
  selectedImage: ImageData | null,
  imagePaths: string[] | null
): Promise<string[] | null> {
  if (selectedImage) {
    try {
      const savedPath = await window.electronAPI.saveImageToMedia({
        data: selectedImage.data,
        mimeType: selectedImage.mimeType,
        name: selectedImage.name,
      });
      return [savedPath];
    } catch (err) {
      console.error("Failed to persist image:", err);
      toast.error("Failed to save image");
      return null;
    }
  } else if (imagePaths && imagePaths.length > 0) {
    return imagePaths;
  }
  return null;
}

/**
 * Ensures a chat session exists, creating one if necessary
 */
export async function ensureSession(
  currentSession: ChatSession | null,
  contentPreview: string,
  createNewSession: MessageHandlers["createNewSession"]
): Promise<ChatSession> {
  if (currentSession) {
    return currentSession;
  }

  try {
    const newSessionRecord = await window.electronAPI.dbCreateSession(
      contentPreview.slice(0, 50) + "..."
    );
    createNewSession(newSessionRecord);
    return { ...newSessionRecord, messages: [] } as ChatSession;
  } catch (e) {
    toast.error("Failed to create chat session");
    console.error("Session creation failed:", e);
    throw new Error("Session creation failed");
  }
}

/**
 * Creates and persists a user message
 */
export async function createUserMessage(
  session: ChatSession,
  messageContent: string,
  storedImagePaths: string[] | null,
  addMessage: MessageHandlers["addMessage"]
): Promise<ChatMessageRecord> {
  const messageRecord: ChatMessageRecord = {
    id: String(crypto.randomUUID()),
    sessionId: session.id,
    content: messageContent,
    role: "user",
    timestamp: Date.now(),
    isError: "",
    imagePaths: storedImagePaths,
    type: "user",
  };

  const newMessage = await window.electronAPI.dbAddChatMessage(messageRecord);
  const updatedSession = await window.electronAPI.dbGetSession(session.id);

  if (!updatedSession) {
    throw new Error("Failed to update session timestamp");
  }

  addMessage(newMessage, updatedSession);
  return newMessage;
}

/**
 * Persists streaming segments to the database.
 * FIX #5: Does NOT call addMessage anymore - caller should use
 * store.replaceStreamingMessages() to swap ephemeral messages with persisted ones.
 */
export async function persistStreamingSegments(
  segments: Array<{ id: string; type: string; content: string }>,
  session: ChatSession
): Promise<ChatMessageRecord[]> {
  const savedRecords: ChatMessageRecord[] = [];
  for (const seg of segments) {
    let contentToSave = seg.content;

    if (seg.type === "plan") {
      try {
        const parsed = JSON.parse(contentToSave);
        if (Array.isArray(parsed)) {
          contentToSave = JSON.stringify(parsed);
        } else if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as any).steps)
        ) {
          // leave as-is
        }
      } catch {
        const match = contentToSave.match(/\[[\s\S]*?\]/);
        if (match) contentToSave = match[0];
      }
    }

    const record: ChatMessageRecord = {
      id: seg.id, // Keep the same ID from streaming segment
      sessionId: session.id,
      content: contentToSave.trim(),
      role: "assistant",
      timestamp: Date.now(),
      isError: "",
      imagePaths: null,
      type: seg.type as any,
    };

    const saved = await window.electronAPI.dbAddChatMessage(record);
    savedRecords.push(saved);
  }
  return savedRecords;
}
