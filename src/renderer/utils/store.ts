import { create } from "zustand";
import type {
  ChatSessionRecord,
  ChatSessionWithMessages,
  ChatMessageRecord,
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
  })
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
  })
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
    updatedSession: ChatSessionRecord
  ) => void;
  // Streaming helpers
  upsertStreamingAssistantMessage: (
    sessionId: string,
    type: ChatMessageRecord["type"],
    chunk: string
  ) => void;
  resetStreamingAssistantState: (sessionId: string) => void;
  /**
   * FIX #5: Replace ephemeral streaming messages with persisted records.
   * Called after persistStreamingSegments to avoid duplicates.
   */
  replaceStreamingMessages: (
    sessionId: string,
    persistedMessages: ChatMessageRecord[],
    ephemeralMessageCount: number
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
        (a, b) => b.updatedAt - a.updatedAt
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

        // Try to find last assistant message of this type that is not marked error
        const msgs = [...session.messages];
        const last = msgs[msgs.length - 1];
        // FIX #6: Use explicit string comparison for isError
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
    ephemeralMessageCount
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
