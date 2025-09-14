import { useState } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../utils/store";
import { type ImageData } from "../../services/imageUtils";

import ChatInput from "./chat-input";
import MessageGroups from "./message-groups";
import { StreamingPreview, useStreaming } from "./streaming";
import {
  handleImagePersistence,
  ensureSession,
  createUserMessage,
  persistStreamingSegments,
  type ChatSession,
} from "./chat-utils";

export default function ChatContainer() {
  const currentSession = useStore((s) => s.currentSession) as ChatSession | null;
  const addMessage = useStore((s) => s.addMessage);
  const createNewSession = useStore((s) => s.createNewSession);

  const [isLoading, setIsLoading] = useState(false);
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isRAGEnabled, setIsRAGEnabled] = useState(false);

  const { isStreaming, segments, segmentsRef, setupStreaming, cleanupStreaming } = useStreaming();

  const resetInputState = () => {
    setContent("");
    setImagePaths(null);
    setSelectedImage(null);
  };

  const handleSendMessage = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isLoading || isStreaming) {
      return;
    }

    console.log("Sending message:", {
      trimmedContent,
      hasImage: !!selectedImage,
      sessionId: currentSession?.id,
    });

    setIsLoading(true);

    try {
      const session = await ensureSession(currentSession, trimmedContent, createNewSession);
      const storedImagePaths = await handleImagePersistence(selectedImage, imagePaths);
      const newMessage = await createUserMessage(session, trimmedContent, storedImagePaths, addMessage);

      setupStreaming();

      try {
        const existingMessages = currentSession?.messages ? [...currentSession.messages] : [];
        const history = existingMessages.concat([newMessage]);

        await window.electronAPI.streamMessageWithHistory(history, {
          rag: isRAGEnabled,
        });

        await persistStreamingSegments(segmentsRef.current, session, addMessage);
      } catch (streamErr) {
        console.error("Streaming error:", streamErr);
        toast.error("Streaming failed");
      } finally {
        cleanupStreaming();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
      resetInputState();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {currentSession && currentSession.messages.length > 0 ? (
        <div className="flex-1 overflow-hidden h-full overflow-y-auto p-4 pb-8 space-y-4 hide-scrollbar max-w-[80%] mx-auto">
          <MessageGroups messages={currentSession.messages} />
          {isStreaming && <StreamingPreview segments={segments} />}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-2xl mb-4 text-blue-700">👋 How can I help you ?</h1>
        </div>
      )}

      <ChatInput
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
        imagePaths={imagePaths}
        setImagePaths={setImagePaths}
        content={content}
        setContent={setContent}
        isLoading={isLoading}
        isStreaming={isStreaming}
        handleSendMessage={handleSendMessage}
        isRAGEnabled={isRAGEnabled}
        setIsRAGEnabled={setIsRAGEnabled}
      />
    </div>
  );
}
