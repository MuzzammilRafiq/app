import { create } from "zustand";
import type {
  ChatSessionRecord,
  ChatSessionWithMessages,
  ChatMessageRecord,
  ChatType,
  StreamChunk,
  VisionLogType,
  VisionLogRecord,
} from "../../common/types";
import { createRendererLogger } from "./logger";

const LOG = createRendererLogger("vision-log-store");

// --------------chatSessions-------------------
interface ChatSessionRecordsStore {
  chatSessionRecords: ChatSessionRecord[];
  setChatSessionRecords: (records: ChatSessionRecord[]) => void;
}
export const useChatSessionRecordsStore = create<ChatSessionRecordsStore>(
  (set) => ({
    chatSessionRecords: [],
    setChatSessionRecords: (records) => set({ chatSessionRecords: records }),
  }),
);

// --------------chatSessionsWithMessages-------------------
interface ChatSessionWithMessagesStore {
  chatSessionsWithMessages: ChatSessionWithMessages[];
  setChatSessionsWithMessages: (sessions: ChatSessionWithMessages[]) => void;
}
export const useChatSessionWithMessagesStore =
  create<ChatSessionWithMessagesStore>((set) => ({
    chatSessionsWithMessages: [],
    setChatSessionsWithMessages: (sessions) =>
      set({ chatSessionsWithMessages: sessions }),
  }));

// --------------currentSession-------------------
interface CurrentSessionStore {
  currentSession: ChatSessionWithMessages | null;
  setCurrentSession: (session: ChatSessionWithMessages | null) => void;
}
export const useCurrentSessionStore = create<CurrentSessionStore>((set) => ({
  currentSession: null,
  setCurrentSession: (session) => set({ currentSession: session }),
}));

// --------------sidebarCollapsed-------------------
interface SidebarCollapsedStore {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}
export const useSidebarCollapsedStore = create<SidebarCollapsedStore>(
  (set) => ({
    sidebarCollapsed: false,
    setSidebarCollapsed: (collapsed: boolean) =>
      set({ sidebarCollapsed: collapsed }),
  }),
);

// --------------currentView-------------------
interface CurrentViewStore {
  currentView: "chat" | "settings" | "vision";
  setCurrentView: (view: "chat" | "settings" | "vision") => void;
}
export const useCurrentViewStore = create<CurrentViewStore>((set) => ({
  currentView: "chat",
  setCurrentView: (view) => set({ currentView: view }),
}));

interface Store {
  chatSessionsWithMessages: ChatSessionWithMessages[];
  currentSession: ChatSessionWithMessages | undefined;
  createNewSession: (newSession: ChatSessionRecord) => void;
  populateSessions: (sessions: ChatSessionWithMessages[]) => void;
  setCurrentSession: (session: ChatSessionWithMessages | undefined) => void;
  addMessage: (
    message: ChatMessageRecord,
    updatedSession: ChatSessionRecord,
  ) => void;
  // Streaming helpers
  upsertStreamingAssistantMessage: (
    sessionId: string,
    type: ChatMessageRecord["type"],
    chunk: string,
  ) => void;
  resetStreamingAssistantState: (sessionId: string) => void;
  /**
   * FIX #5: Replace ephemeral streaming messages with persisted records.
   * Called after persistStreamingSegments to avoid duplicates.
   */
  replaceStreamingMessages: (
    sessionId: string,
    persistedMessages: ChatMessageRecord[],
    ephemeralMessageCount: number,
  ) => void;
}
interface ChatTitleStore {
  chatTitle: string;
  setChatTitle: (title: string) => void;
}
export const useChatTitleStore = create<ChatTitleStore>((set) => ({
  chatTitle: "",
  setChatTitle: (title) => set({ chatTitle: title }),
}));
export const useStore = create<Store>((set) => ({
  chatSessionsWithMessages: [],
  currentSession: undefined,
  createNewSession: (newSession) => {
    set((state) => {
      // Add new session at the beginning since it's the most recent
      const newSessionWithMessages = { ...newSession, messages: [] };
      return {
        chatSessionsWithMessages: [
          newSessionWithMessages,
          ...state.chatSessionsWithMessages,
        ],
        currentSession: newSessionWithMessages,
      };
    });
  },
  populateSessions: (sessions) => {
    set((_state) => {
      // Sort sessions by updatedAt descending (most recent first) to ensure correct order
      const sortedSessions = sessions.sort((a, b) => b.updatedAt - a.updatedAt);

      return {
        chatSessionsWithMessages: sortedSessions,
        currentSession:
          sortedSessions.length > 0 ? sortedSessions[0] : undefined,
      };
    });
  },
  setCurrentSession: (session) => {
    set({ currentSession: session });
  },
  addMessage: (message, updatedSession) => {
    set((state) => {
      // Update the session with the new message
      const updatedSessions = state.chatSessionsWithMessages.map((session) => {
        if (session.id === updatedSession.id) {
          return {
            ...updatedSession,
            messages: [...session.messages, message],
          };
        }
        return session;
      });

      // Sort sessions by updatedAt descending (most recent first)
      const sortedSessions = updatedSessions.sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );

      return {
        chatSessionsWithMessages: sortedSessions,
        currentSession:
          state.currentSession && state.currentSession.id === updatedSession.id
            ? {
                ...updatedSession,
                messages: [...state.currentSession.messages, message],
              }
            : state.currentSession,
      };
    });
  },
  // During streaming we keep one in-memory assistant message per type and session.
  upsertStreamingAssistantMessage: (sessionId, type, chunk) => {
    set((state) => {
      const updatedSessions = state.chatSessionsWithMessages.map((session) => {
        if (session.id !== sessionId) return session;

        const msgs = [...session.messages];
        if (type === "plan") {
          let idx = -1;
          for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i];
            if (
              m &&
              m.role === "assistant" &&
              m.type === "plan" &&
              m.isError === ""
            ) {
              idx = i;
              break;
            }
          }
          if (idx >= 0) {
            const existing = msgs[idx]!;
            const updated: ChatMessageRecord = {
              ...existing,
              content: chunk,
              timestamp: Date.now(),
            };
            msgs.splice(idx, 1);
            msgs.push(updated);
          } else {
            const newMsg: ChatMessageRecord = {
              id: String(crypto.randomUUID()),
              sessionId,
              content: chunk,
              role: "assistant",
              timestamp: Date.now(),
              isError: "",
              imagePaths: null,
              type: "plan",
            };
            msgs.push(newMsg);
          }
        } else {
          const last = msgs[msgs.length - 1];
          if (
            last &&
            last.role === "assistant" &&
            last.type === type &&
            last.isError === ""
          ) {
            const merged: ChatMessageRecord = {
              ...last,
              content: last.content + chunk,
              timestamp: Date.now(),
            };
            msgs[msgs.length - 1] = merged;
          } else {
            const newMsg: ChatMessageRecord = {
              id: String(crypto.randomUUID()),
              sessionId,
              content: chunk,
              role: "assistant",
              timestamp: Date.now(),
              isError: "",
              imagePaths: null,
              type,
            };
            msgs.push(newMsg);
          }
        }

        return { ...session, messages: msgs };
      });

      // Keep currentSession in sync if it's the same session
      let newCurrent = state.currentSession;
      if (state.currentSession && state.currentSession.id === sessionId) {
        const sessionIdx = updatedSessions.findIndex((s) => s.id === sessionId);
        if (sessionIdx >= 0) newCurrent = updatedSessions[sessionIdx];
      }

      return {
        chatSessionsWithMessages: updatedSessions,
        currentSession: newCurrent,
      };
    });
  },
  resetStreamingAssistantState: (_sessionId) => {
    // No-op for now; ephemeral messages are part of session messages until persisted
  },

  /**
   * FIX #5: Replace ephemeral streaming messages with persisted records.
   * This removes the last N ephemeral assistant messages and replaces them
   * with the persisted records from the database.
   */
  replaceStreamingMessages: (
    sessionId,
    persistedMessages,
    ephemeralMessageCount,
  ) => {
    set((state) => {
      const updatedSessions = state.chatSessionsWithMessages.map((session) => {
        if (session.id !== sessionId) return session;

        // Remove the last N ephemeral messages (created during streaming)
        const msgs = [...session.messages];
        const baseMessages = msgs.slice(0, msgs.length - ephemeralMessageCount);

        // Add the persisted messages
        return {
          ...session,
          messages: [...baseMessages, ...persistedMessages],
        };
      });

      // Keep currentSession in sync
      let newCurrent = state.currentSession;
      if (state.currentSession && state.currentSession.id === sessionId) {
        const sessionIdx = updatedSessions.findIndex((s) => s.id === sessionId);
        if (sessionIdx >= 0) newCurrent = updatedSessions[sessionIdx];
      }

      return {
        chatSessionsWithMessages: updatedSessions,
        currentSession: newCurrent,
      };
    });
  },
}));

interface StreamingSegment {
  id: string;
  type: ChatType;
  content: string;
  sessionId: string;
  requestId: string;
}

interface StreamingStore {
  isStreaming: boolean;
  activeRequestIdsBySession: Record<string, string>;
  streamingSegments: StreamingSegment[];
  streamingSegmentsBySession: Record<string, StreamingSegment[]>;
  startStreaming: (sessionId: string, requestId: string) => void;
  finishStreaming: (sessionId: string, requestId: string) => void;
  addStreamingChunk: (chunk: StreamChunk) => void;
  reconcileFinalResponse: (
    sessionId: string,
    requestId: string,
    content: string,
  ) => void;
  updateStreamingSegment: (id: string, content: string) => void;
  clearSessionStreaming: (sessionId: string) => void;
}

const EMPTY_STREAMING_SEGMENTS: StreamingSegment[] = [];

function flattenStreamingSegments(
  streamingSegmentsBySession: Record<string, StreamingSegment[]>,
): StreamingSegment[] {
  return Object.values(streamingSegmentsBySession).flat();
}

export const useStreamingStore = create<StreamingStore>((set) => ({
  isStreaming: false,
  activeRequestIdsBySession: {},
  streamingSegments: [],
  streamingSegmentsBySession: {},
  startStreaming: (sessionId, requestId) =>
    set((state) => {
      const activeRequestIdsBySession = {
        ...state.activeRequestIdsBySession,
        [sessionId]: requestId,
      };
      const streamingSegmentsBySession = {
        ...state.streamingSegmentsBySession,
        [sessionId]: EMPTY_STREAMING_SEGMENTS,
      };

      return {
        isStreaming: Object.keys(activeRequestIdsBySession).length > 0,
        activeRequestIdsBySession,
        streamingSegmentsBySession,
        streamingSegments: flattenStreamingSegments(streamingSegmentsBySession),
      };
    }),
  finishStreaming: (sessionId, requestId) =>
    set((state) => {
      if (state.activeRequestIdsBySession[sessionId] !== requestId) {
        return state;
      }

      const activeRequestIdsBySession = { ...state.activeRequestIdsBySession };
      delete activeRequestIdsBySession[sessionId];

      return {
        isStreaming: Object.keys(activeRequestIdsBySession).length > 0,
        activeRequestIdsBySession,
      };
    }),
  addStreamingChunk: (chunk) =>
    set((state) => {
      if (state.activeRequestIdsBySession[chunk.sessionId] !== chunk.requestId) {
        return state;
      }

      const updated = [
        ...(state.streamingSegmentsBySession[chunk.sessionId] ??
          EMPTY_STREAMING_SEGMENTS),
      ];

      if (chunk.type === "general") {
        const lastIndex = updated.length - 1;
        const last = updated[lastIndex];
        if (
          last &&
          last.sessionId === chunk.sessionId &&
          last.requestId === chunk.requestId &&
          last.type === "general"
        ) {
          updated[lastIndex] = {
            ...last,
            content: last.content + chunk.chunk,
          };
        } else if (
          last &&
          last.sessionId === chunk.sessionId &&
          last.requestId === chunk.requestId &&
          last.type === "stream"
        ) {
          updated[lastIndex] = {
            ...last,
            type: "general",
            content: chunk.chunk ? chunk.chunk : last.content,
          };
        } else {
          updated.push({
            id: crypto.randomUUID(),
            type: "general",
            content: chunk.chunk,
            sessionId: chunk.sessionId,
            requestId: chunk.requestId,
          });
        }
      } else if (chunk.type === "plan") {
        // Overwrite existing plan
        const existingIndex = updated.findIndex(
          (s) =>
            s.type === "plan" &&
            s.sessionId === chunk.sessionId &&
            s.requestId === chunk.requestId,
        );
        if (existingIndex >= 0) {
          const existing = updated[existingIndex];
          if (existing) {
            updated[existingIndex] = {
              id: existing.id,
              type: existing.type,
              content: chunk.chunk,
              sessionId: existing.sessionId,
              requestId: existing.requestId,
            };
          }
        } else {
          updated.push({
            id: crypto.randomUUID(),
            type: "plan",
            content: chunk.chunk,
            sessionId: chunk.sessionId,
            requestId: chunk.requestId,
          });
        }
      } else {
        // Append to last segment of same type
        const last = updated[updated.length - 1];
        if (
          last &&
          last.type === chunk.type &&
          last.sessionId === chunk.sessionId &&
          last.requestId === chunk.requestId
        ) {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + chunk.chunk,
          };
        } else {
          updated.push({
            id: crypto.randomUUID(),
            type: chunk.type,
            content: chunk.chunk,
            sessionId: chunk.sessionId,
            requestId: chunk.requestId,
          });
        }
      }
      const streamingSegmentsBySession = {
        ...state.streamingSegmentsBySession,
        [chunk.sessionId]: updated,
      };

      return {
        streamingSegmentsBySession,
        streamingSegments: flattenStreamingSegments(streamingSegmentsBySession),
      };
    }),
  reconcileFinalResponse: (sessionId, requestId, content) =>
    set((state) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return state;
      }

      const updated = [
        ...(state.streamingSegmentsBySession[sessionId] ??
          EMPTY_STREAMING_SEGMENTS),
      ];
      let generalIndex = -1;

      for (let i = updated.length - 1; i >= 0; i--) {
        const segment = updated[i];
        if (
          segment &&
          segment.sessionId === sessionId &&
          segment.requestId === requestId &&
          segment.type === "general"
        ) {
          generalIndex = i;
          break;
        }
      }

      if (generalIndex >= 0) {
        const existing = updated[generalIndex];
        if (existing && existing.content !== trimmedContent) {
          updated[generalIndex] = {
            ...existing,
            content: trimmedContent,
          };
          const streamingSegmentsBySession = {
            ...state.streamingSegmentsBySession,
            [sessionId]: updated,
          };
          return {
            streamingSegmentsBySession,
            streamingSegments: flattenStreamingSegments(streamingSegmentsBySession),
          };
        }
        return state;
      }

      updated.push({
        id: crypto.randomUUID(),
        type: "general",
        content: trimmedContent,
        sessionId,
        requestId,
      });

      const streamingSegmentsBySession = {
        ...state.streamingSegmentsBySession,
        [sessionId]: updated,
      };

      return {
        streamingSegmentsBySession,
        streamingSegments: flattenStreamingSegments(streamingSegmentsBySession),
      };
    }),
  updateStreamingSegment: (id: string, content: string) =>
    set((state) => {
      const streamingSegmentsBySession = { ...state.streamingSegmentsBySession };
      let changed = false;

      for (const [sessionId, sessionSegments] of Object.entries(
        streamingSegmentsBySession,
      )) {
        const nextSegments = sessionSegments.map((segment) =>
          segment.id === id ? { ...segment, content } : segment,
        );

        if (nextSegments.some((segment, index) => segment !== sessionSegments[index])) {
          streamingSegmentsBySession[sessionId] = nextSegments;
          changed = true;
          break;
        }
      }

      if (!changed) {
        return state;
      }

      return {
        streamingSegmentsBySession,
        streamingSegments: flattenStreamingSegments(streamingSegmentsBySession),
      };
    }),
  clearSessionStreaming: (sessionId) =>
    set((state) => {
      const streamingSegmentsBySession = { ...state.streamingSegmentsBySession };
      delete streamingSegmentsBySession[sessionId];

      return {
        streamingSegmentsBySession,
        streamingSegments: flattenStreamingSegments(streamingSegmentsBySession),
      };
    }),
}));

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
  currentRunId: string | null;
  addLog: (
    entry: Omit<VisionLogEntry, "id" | "timestamp">,
    runId?: string,
  ) => void;
  setLogs: (logs: VisionLogEntry[]) => void; // For loading from database
  clearLogs: () => void;
  setExecuting: (executing: boolean) => void;
  setCurrentSessionId: (id: string | null) => void;
  setCurrentRunId: (id: string | null) => void;
}

/**
 * Persist a log entry to the database
 * Handles image saving for image-preview type logs
 */
async function persistLog(
  sessionId: string,
  entry: VisionLogEntry,
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
        LOG.ERROR("Failed to save vision image", {
          entryId: entry.id,
          entryType: entry.type,
        }, err);
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
    LOG.ERROR("Failed to persist vision log", {
      sessionId,
      entryId: entry.id,
      entryType: entry.type,
      title: entry.title,
    }, err);
  }
}

export const useVisionLogStore = create<VisionLogStore>((set, get) => ({
  logs: [],
  isExecuting: false,
  currentSessionId: null,
  currentRunId: null,

  addLog: (entry, runId) => {
    const activeRunId = get().currentRunId;
    if (runId) {
      if (!activeRunId || runId !== activeRunId) {
        return;
      }
    }

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
  setLogs: (logs) => set({ logs, currentRunId: null, isExecuting: false }),

  clearLogs: () => set({ logs: [], currentRunId: null, isExecuting: false }),

  setExecuting: (executing) => set({ isExecuting: executing }),

  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  setCurrentRunId: (id) => set({ currentRunId: id }),
}));

const EMPTY_MESSAGES: ChatMessageRecord[] = [];

// Granular selectors to prevent unnecessary re-renders
export const selectSessionId = (state: Store) => state.currentSession?.id;
export const selectSessionTitle = (state: Store) => state.currentSession?.title;
export const selectSessionMessages = (state: Store) =>
  state.currentSession?.messages || EMPTY_MESSAGES;
export const selectChatSessions = (state: Store) =>
  state.chatSessionsWithMessages;

// Selector helpers that maintain reference equality when data hasn't changed
export const useSessionId = () => useStore(selectSessionId);
export const useSessionMessages = () => useStore(selectSessionMessages);
export const useChatSessions = () => useStore(selectChatSessions);
export const useSessionTitle = () => useStore(selectSessionTitle);
