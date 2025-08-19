import type { ChatMessage } from "./llm";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = "chat-sessions";

export function loadChatSessions(): ChatSession[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const sessions = JSON.parse(data);
    return sessions.map((session: any) => ({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      messages: session.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    }));
  } catch (error) {
    console.error("Failed to load chat sessions:", error);
    return [];
  }
}

export function saveChatSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to save chat sessions:", error);
  }
}

export function createNewSession(): ChatSession {
  return {
    id: Date.now().toString(),
    title: "New Chat",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function updateSessionTitle(session: ChatSession): ChatSession {
  // Auto-generate title from first user message
  const firstUserMessage = session.messages.find((msg) => msg.role === "user" && msg.content.trim());
  if (firstUserMessage) {
    const title =
      firstUserMessage.content.length > 50
        ? firstUserMessage.content.substring(0, 47) + "..."
        : firstUserMessage.content;
    return {
      ...session,
      title: title || "New Chat",
      updatedAt: new Date(),
    };
  }
  return session;
}

export function deleteSession(sessions: ChatSession[], sessionId: string): ChatSession[] {
  return sessions.filter((session) => session.id !== sessionId);
}
