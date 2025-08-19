import { useState, useEffect } from "react";
import {
  loadChatSessions,
  saveChatSessions,
  createNewSession,
  deleteSession,
  type ChatSession,
} from "../services/chatStorage";

export function useSessionManager() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const currentSession = sessions.find((session) => session.id === currentSessionId);

  const messages = currentSession?.messages || [];

  /**
   * Load sessions from storage on component mount.
   * Automatically selects the first session if no current session is set.
   */
  useEffect(() => {
    const loadedSessions = loadChatSessions();
    setSessions(loadedSessions);

    // If no current session and we have sessions, select the first one
    if (!currentSessionId && loadedSessions.length > 0) {
      setCurrentSessionId(loadedSessions[0]?.id || null);
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      saveChatSessions(sessions);
    }
  }, [sessions]);

  const handleNewSession = () => {
    const newSession = createNewSession();
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  /**
   * Switches to a different chat session by its ID.
   * @param {string} sessionId - The ID of the session to switch to
   */
  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => deleteSession(prev, sessionId));

    // If we're deleting the current session, select the first available one
    if (currentSessionId === sessionId) {
      const remainingSessions = deleteSession(sessions, sessionId);
      setCurrentSessionId(remainingSessions.length > 0 ? remainingSessions[0]?.id || null : null);
    }
  };

  return {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    messages,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
  };
}
