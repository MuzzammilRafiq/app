import { useEffect, useRef, useState } from "react";
import ChatInput, { type ChatInputHandle, type Status } from "./ChatInput";
import ChatMessage from "./ChatMessage";
import { useChatSessionRecordsStore, useCurrentSessionStore } from "../utils/store";
import toast from "react-hot-toast";

export default function ChatContainer() {
  const { currentSession, setCurrentSession } = useCurrentSessionStore();
  const chatSessionRecords = useChatSessionRecordsStore((s) => s.chatSessionRecords);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [status, setStatus] = useState<Status>({
    isStreaming: false,
    isLoading: false,
  });
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Fallback: if currentSession is ever null (e.g. after hot reload) but we have sessions, auto-select first.
  useEffect(() => {
    if (!currentSession && chatSessionRecords.length > 0) {
      const first = chatSessionRecords[0];
      if (!first) return; // type guard
      setCurrentSession({
        id: first.id,
        title: first.title,
        createdAt: first.createdAt,
        updatedAt: first.updatedAt,
        messages: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession, chatSessionRecords.length]);
  // Ensure messages are loaded when switching sessions (Sidebar sets stub with empty messages)
  useEffect(() => {
    let cancelled = false;
    const loadMessages = async () => {
      if (!currentSession) return;
      if (currentSession.messages.length > 0) return; // already have them
      setIsLoadingMessages(true);
      try {
        const id = currentSession.id; // capture
        const msgs = await window.electronAPI.dbGetChatMessages(id);
        if (cancelled) return;
        // Only update if still same session id
        if (currentSession && currentSession.id === id && currentSession.messages.length === 0) {
          setCurrentSession({ ...currentSession, messages: msgs });
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load messages for session", currentSession.id, e);
          toast.error("Failed to load messages");
        }
      } finally {
        if (!cancelled) setIsLoadingMessages(false);
      }
    };
    loadMessages();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id]);
  const handleSendMessage = async (sessionId: string, content: string) => {
    try {
      // Ensure we have an up-to-date session (currentSession might still be null right after creation)
      let sessionRef = currentSession;
      if (!sessionRef || sessionRef.id !== sessionId) {
        const fetched = await window.electronAPI.dbGetSession(sessionId);
        if (!fetched) {
          toast.error("Session not found");
          return;
        }
        if (!sessionRef) {
          sessionRef = { ...fetched, messages: [] };
          setCurrentSession(sessionRef); // initialize
        }
      }

      const newMessage = await window.electronAPI.dbAddChatMessage({
        id: crypto.randomUUID(),
        sessionId,
        content,
        role: "user",
        timestamp: Date.now(),
        isError: "",
        imagePaths: imagePaths,
        type: "user",
      });

      // Re-fetch session metadata (e.g., updatedAt) but not messages
      const updatedSessionRecord = await window.electronAPI.dbGetSession(sessionId);
      const updatedSession = {
        ...(updatedSessionRecord || sessionRef!),
        messages: [...(sessionRef?.messages || []), newMessage],
      };
      setCurrentSession(updatedSession);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages / Placeholder */}
      {(() => {
        if (!currentSession) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <h1 className="text-2xl mb-4 text-blue-700">👋 How can I help you ?</h1>
            </div>
          );
        }
        if (isLoadingMessages && currentSession.messages.length === 0) {
          return <div className="flex-1 flex items-center justify-center text-gray-500">Loading messages...</div>;
        }
        if (currentSession.messages.length === 0) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <h1 className="text-2xl mb-4 text-blue-700">👋 How can I help you ?</h1>
            </div>
          );
        }
        return (
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-4 pb-8 space-y-4 hide-scrollbar max-w-[80%] mx-auto">
              {currentSession.messages.map((message) => (
                <ChatMessage key={message.id} {...message} />
              ))}
            </div>
          </div>
        );
      })()}
      <div className="flex-shrink-0 px-4 pb-4">
        <ChatInput
          ref={chatInputRef}
          onSendMessage={handleSendMessage}
          sessionId={currentSession ? currentSession.id : ""}
          status={status}
          setStatus={setStatus}
          imagePaths={imagePaths}
          setImagePaths={setImagePaths}
        />
      </div>
    </div>
  );
}
