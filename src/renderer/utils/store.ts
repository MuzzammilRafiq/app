import { create } from "zustand";
import type {
  ChatSessionRecord,
  ChatSessionWithMessages,
  ChatMessageRecord,
  ChatType,
  StreamChunk,
} from "../../common/types";

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
  currentView: "chat" | "settings";
  setCurrentView: (view: "chat" | "settings") => void;
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
            const isSnapshot = (() => {
              try {
                const parsed = JSON.parse(chunk);
                return (
                  Array.isArray(parsed) ||
                  (parsed &&
                    typeof parsed === "object" &&
                    Array.isArray((parsed as any).steps))
                );
              } catch {
                return false;
              }
            })();
            const updated: ChatMessageRecord = {
              ...existing,
              content: isSnapshot ? chunk : existing.content + chunk,
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
}

interface StreamingStore {
  isStreaming: boolean;
  streamingSegments: StreamingSegment[];
  setStreaming: (isStreaming: boolean) => void;
  addStreamingChunk: (chunk: StreamChunk) => void;
  clearStreaming: () => void;
}

export const useStreamingStore = create<StreamingStore>((set) => ({
  isStreaming: false,
  streamingSegments: [],
  setStreaming: (isStreaming) => set({ isStreaming }),
  addStreamingChunk: (chunk) =>
    set((state) => {
      const updated = [...state.streamingSegments];

      if (chunk.type === "plan") {
        // Overwrite existing plan
        const existingIndex = updated.findIndex((s) => s.type === "plan");
        if (existingIndex >= 0) {
          const existing = updated[existingIndex];
          if (existing) {
            updated[existingIndex] = {
              id: existing.id,
              type: existing.type,
              content: chunk.chunk,
            };
          }
        } else {
          updated.push({
            id: crypto.randomUUID(),
            type: "plan",
            content: chunk.chunk,
          });
        }
      } else {
        // Append to last segment of same type
        const last = updated[updated.length - 1];
        if (last && last.type === chunk.type) {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + chunk.chunk,
          };
        } else {
          updated.push({
            id: crypto.randomUUID(),
            type: chunk.type,
            content: chunk.chunk,
          });
        }
      }
      return { streamingSegments: updated };
    }),
  clearStreaming: () => set({ streamingSegments: [], isStreaming: false }),
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
