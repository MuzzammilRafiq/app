import { useEffect, memo } from "react";
import { useStore } from "../../../utils/store";
import {
  SessionItem,
  EmptyState,
  formatRelativeTime,
} from "../../../components/sidebar/shared";
import { ChatIcon } from "../../../components/icons";

function ChatSidebarInner() {
  const populateSessions = useStore((s) => s.populateSessions);
  const currentSession = useStore((s) => s.currentSession);
  const chatSessionsWithMessages = useStore((s) => s.chatSessionsWithMessages);
  const setCurrentSession = useStore((s) => s.setCurrentSession);

  const onDeleteSession = async (id: string) => {
    try {
      await window.electronAPI.dbDeleteSession(id);
      const sessions =
        await window.electronAPI.dbGetAllSessionsWithMessages(50);
      populateSessions(sessions);
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  // Load chat sessions
  useEffect(() => {
    (async () => {
      const sessions =
        await window.electronAPI.dbGetAllSessionsWithMessages(50);
      populateSessions(sessions);
    })();
  }, [populateSessions]);

  if (chatSessionsWithMessages.length === 0) {
    return (
      <EmptyState
        icon={<ChatIcon />}
        title="No conversations yet"
        subtitle="Start a new chat to begin"
      />
    );
  }

  return (
    <>
      {chatSessionsWithMessages.map((session) => (
        <SessionItem
          key={session.id}
          isSelected={currentSession?.id === session.id}
          title={session.title || "New Conversation"}
          subtitle={`${session.messages?.length || 0} messages • ${formatRelativeTime(session.createdAt)}`}
          onClick={() => setCurrentSession(session)}
          onDelete={(e) => {
            e.stopPropagation();
            void onDeleteSession(session.id);
          }}
          icon={<ChatIcon />}
        />
      ))}
    </>
  );
}

export const ChatSidebar = memo(ChatSidebarInner);
export default ChatSidebar;
