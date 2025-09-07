import { create } from "zustand";
import type { ChatSessionRecord, ChatSessionWithMessages, ChatMessageRecord } from "../../electron/common/types";

// --------------chatSessions-------------------
interface ChatSessionRecordsStore {
  chatSessionRecords: ChatSessionRecord[];
  setChatSessionRecords: (records: ChatSessionRecord[]) => void;
}
export const useChatSessionRecordsStore = create<ChatSessionRecordsStore>((set) => ({
  chatSessionRecords: [],
  setChatSessionRecords: (records) => set({ chatSessionRecords: records }),
}));

// --------------chatSessionsWithMessages-------------------
interface ChatSessionWithMessagesStore {
  chatSessionsWithMessages: ChatSessionWithMessages[];
  setChatSessionsWithMessages: (sessions: ChatSessionWithMessages[]) => void;
}
export const useChatSessionWithMessagesStore = create<ChatSessionWithMessagesStore>((set) => ({
  chatSessionsWithMessages: [],
  setChatSessionsWithMessages: (sessions) => set({ chatSessionsWithMessages: sessions }),
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
export const useSidebarCollapsedStore = create<SidebarCollapsedStore>((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
}));

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
  currentSession?: ChatSessionWithMessages;
  createNewSession: (newSession: ChatSessionRecord) => void;
  populateSessions: (sessions: ChatSessionWithMessages[]) => void;
  setCurrentSession: (session: ChatSessionWithMessages) => void;
  addMessage: (message: ChatMessageRecord, updatedSession: ChatSessionRecord) => void;
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
        chatSessionsWithMessages: [newSessionWithMessages, ...state.chatSessionsWithMessages],
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
        currentSession: sortedSessions.length > 0 ? sortedSessions[0] : undefined,
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
          return { ...updatedSession, messages: [...session.messages, message] };
        }
        return session;
      });

      // Sort sessions by updatedAt descending (most recent first)
      const sortedSessions = updatedSessions.sort((a, b) => b.updatedAt - a.updatedAt);

      return {
        chatSessionsWithMessages: sortedSessions,
        currentSession:
          state.currentSession && state.currentSession.id === updatedSession.id
            ? { ...updatedSession, messages: [...state.currentSession.messages, message] }
            : state.currentSession,
      };
    });
  },
}));
