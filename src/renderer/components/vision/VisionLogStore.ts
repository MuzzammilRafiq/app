import { create } from "zustand";
import type { VisionLogType, VisionLogRecord } from "../../../common/types";

/**
 * Vision Log Entry types - extends VisionLogRecord for in-memory use
 */
export type { VisionLogType };

export interface VisionLogEntry {
  id: string;
  timestamp: number;
  type: VisionLogType;
  title: string;
  content: string;
  imageBase64?: string; // Optional for image previews (in-memory only, not persisted)
  imagePath?: string | null; // Persisted path to saved image
}

interface VisionLogStore {
  logs: VisionLogEntry[];
  isExecuting: boolean;
  currentSessionId: string | null;
  addLog: (entry: Omit<VisionLogEntry, "id" | "timestamp">) => void;
  setLogs: (logs: VisionLogEntry[]) => void;  // For loading from database
  clearLogs: () => void;
  setExecuting: (executing: boolean) => void;
  setCurrentSessionId: (id: string | null) => void;
}

/**
 * Persist a log entry to the database
 * Handles image saving for image-preview type logs
 */
async function persistLog(
  sessionId: string,
  entry: VisionLogEntry
): Promise<void> {
  try {
    let imagePath: string | null = null;

    // Save image to media folder if it's an image preview
    if (entry.type === "image-preview" && entry.imageBase64) {
      try {
        imagePath = await window.electronAPI.saveImageToMedia({
          data: entry.imageBase64,
          mimeType: "image/png",
          name: `vision-${entry.id}.png`,
        });
      } catch (err) {
        console.error("Failed to save vision image:", err);
      }
    }

    const logRecord: VisionLogRecord = {
      id: entry.id,
      sessionId,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      imagePath,
      timestamp: entry.timestamp,
    };

    await window.electronAPI.dbAddVisionLog(logRecord);
  } catch (err) {
    console.error("Failed to persist vision log:", err);
  }
}

export const useVisionLogStore = create<VisionLogStore>((set, get) => ({
  logs: [],
  isExecuting: false,
  currentSessionId: null,

  addLog: (entry) => {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const fullEntry: VisionLogEntry = {
      ...entry,
      id,
      timestamp,
    };

    set((state) => ({
      logs: [...state.logs, fullEntry],
    }));

    // Persist to database if we have a session
    const sessionId = get().currentSessionId;
    if (sessionId) {
      persistLog(sessionId, fullEntry);
    }
  },

  // Set logs directly from database (for loading saved sessions)
  setLogs: (logs) => set({ logs }),

  clearLogs: () => set({ logs: [] }),

  setExecuting: (executing) => set({ isExecuting: executing }),

  setCurrentSessionId: (id) => set({ currentSessionId: id }),
}));
