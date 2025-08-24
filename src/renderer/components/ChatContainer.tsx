import { useRef, useState } from "react";
import ChatInput, { type ChatInputHandle, type Status } from "./ChatInput";
import ChatMessage from "./ChatMessage";
import { useCurrentSessionStore } from "../utils/store";
import { randomUUID } from "crypto";
import toast from "react-hot-toast";

export default function ChatContainer() {
  const { currentSession, setCurrentSession } = useCurrentSessionStore();
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [status, setStatus] = useState<Status>({
    isStreaming: false,
    isLoading: false,
  });
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const handleSendMessage = async (sessionId: string, content: string) => {
    if (!currentSession) return;
    try {
      const newMessage = await window.electronAPI.dbAddChatMessage({
        id: randomUUID().toString(),
        sessionId,
        content,
        role: "user",
        timestamp: Date.now(),
        isError: "",
        imagePaths: imagePaths,
        type: "user",
      });
      const updatedSessionRecord = await window.electronAPI.dbGetSession(currentSession.id)!;

      const newSessionMessages = [...currentSession.messages, newMessage];
      setCurrentSession({ ...updatedSessionRecord!, messages: newSessionMessages });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };
  return (
    <div className="flex-1 flex flex-col h-full">
      {currentSession && currentSession.messages.length > 0 ? (
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4 pb-8 space-y-4 hide-scrollbar max-w-[80%] mx-auto">
            {currentSession.messages.map((message) => (
              <ChatMessage key={message.id} {...message} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-2xl mb-4 text-blue-700">👋 How can I help you ?</h1>
        </div>
      )}
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
