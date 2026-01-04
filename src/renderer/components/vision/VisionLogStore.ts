import { create } from "zustand";

/**
 * Vision Log Entry types
 */
export type VisionLogType =
  | "server"
  | "llm-request"
  | "llm-response"
  | "thinking"
  | "status"
  | "error"
  | "image-preview";

export interface VisionLogEntry {
  id: string;
  timestamp: number;
  type: VisionLogType;
  title: string;
  content: string;
  imageBase64?: string; // Optional for image previews
}

interface VisionLogStore {
  logs: VisionLogEntry[];
  isExecuting: boolean;
  addLog: (entry: Omit<VisionLogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;
  setExecuting: (executing: boolean) => void;
}

export const useVisionLogStore = create<VisionLogStore>((set) => ({
  logs: [],
  isExecuting: false,

  addLog: (entry) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      ],
    })),

  clearLogs: () => set({ logs: [] }),

  setExecuting: (executing) => set({ isExecuting: executing }),
}));
