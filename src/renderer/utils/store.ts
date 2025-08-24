import { create } from "zustand";
import type { ChatSessionRecord, ChatSessionWithMessages } from "../../common/types";

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
