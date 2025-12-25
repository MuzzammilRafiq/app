import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../utils/store";
import { type ImageData } from "../../services/imageUtils";
import type { ChatMessageRecord } from "../../../common/types";

import ChatInput from "./chat-input";
import MessageGroups from "./message-groups";
import MessageDetailsSidebar from "./message-details-sidebar";
import { useStreaming } from "./streaming";
import {
  handleImagePersistence,
  ensureSession,
  createUserMessage,
  persistStreamingSegments,
  type ChatSession,
} from "./chat-utils";
import { loadSettings } from "../../services/settingsStorage";

export default function ChatContainer() {
  const currentSession = useStore(
    (s) => s.currentSession,
  ) as ChatSession | null;
  const addMessage = useStore((s) => s.addMessage);
  const createNewSession = useStore((s) => s.createNewSession);

  const [isLoading, setIsLoading] = useState(false);
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isRAGEnabled, setIsRAGEnabled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPlans, setSidebarPlans] = useState<ChatMessageRecord[]>([]);
  const [sidebarLogs, setSidebarLogs] = useState<ChatMessageRecord[]>([]);
  const [sidebarSources, setSidebarSources] = useState<ChatMessageRecord[]>([]);
  const [autoOpenEnabled] = useState(true);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const { isStreaming, segmentsRef, setupStreaming, cleanupStreaming } =
    useStreaming();

  const resetInputState = () => {
    setContent("");
    setImagePaths(null);
    setSelectedImage(null);
  };

  const openSidebar = (payload: {
    plans: ChatMessageRecord[];
    logs: ChatMessageRecord[];
    sources: ChatMessageRecord[];
  }) => {
    setSidebarPlans(payload.plans || []);
    setSidebarLogs(payload.logs || []);
    setSidebarSources(payload.sources || []);
    setSidebarOpen(true);
  };
  const closeSidebar = () => setSidebarOpen(false);

  // Auto-open sidebar when new assistant details arrive
  const prevCountRef = useRef(0);
  const messages = (currentSession?.messages ?? []) as ChatMessageRecord[];

  const computeLastAssistantGroup = () => {
    if (!messages.length)
      return {
        plans: [] as ChatMessageRecord[],
        logs: [] as ChatMessageRecord[],
        sources: [] as ChatMessageRecord[],
      };
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    const assistantGroup = messages.slice(lastUserIdx + 1);
    const plans = assistantGroup.filter((m) => m.type === "plan");
    const logs = assistantGroup.filter((m) => m.type === "log");
    const sources = assistantGroup.filter((m) => m.type === "source");
    return { plans, logs, sources };
  };

  // Effect to auto-open details sidebar for new messages
  // Conditions:
  // - Message count increased OR content changed significantly
  // - There are any plans/logs/sources in the last assistant group
  // - Open the sidebar if closed; update if open
  // - Avoid auto-opening on very first render unless new content arrived
  useEffect(() => {
    if (!autoOpenEnabled) return;
    const prev = prevCountRef.current as number;
    const curr = messages.length;
    const { plans, logs, sources } = computeLastAssistantGroup();
    const hasDetails =
      plans.length > 0 || logs.length > 0 || sources.length > 0;

    const isNew = curr > prev; // naive new-message detection
    // Also consider first-time hydration: don't auto-open unless something new arrived
    if ((isNew || (!hasAutoOpened && prev === 0 && curr > 0)) && hasDetails) {
      setSidebarPlans(plans);
      setSidebarLogs(logs);
      setSidebarSources(sources);
      setHasAutoOpened(true);
    } else if (hasDetails && sidebarOpen) {
      // Keep sidebar content in sync if it's already open
      setSidebarPlans(plans);
      setSidebarLogs(logs);
      setSidebarSources(sources);
    }
    prevCountRef.current = curr;
  }, [messages, autoOpenEnabled, sidebarOpen, hasAutoOpened]);

  const handleSendMessage = async () => {
    const settings = loadSettings();
    if (!settings.openrouterApiKey) {
      toast.error("OpenRouter API key not found in settings");
      return;
    }
    const trimmedContent = content.trim();
    const hasAnyImage =
      !!selectedImage || (imagePaths && imagePaths.length > 0);
    if ((!trimmedContent && !hasAnyImage) || isLoading || isStreaming) {
      return;
    }

    console.log("Sending message:", {
      trimmedContent,
      hasImage: !!selectedImage,
      sessionId: currentSession?.id,
    });

    setIsLoading(true);
    resetInputState();
    try {
      const session = await ensureSession(
        currentSession,
        trimmedContent || (hasAnyImage ? "Image message" : ""),
        createNewSession,
      );
      const storedImagePaths = await handleImagePersistence(
        selectedImage,
        imagePaths,
      );
      const newMessage = await createUserMessage(
        session,
        trimmedContent || "",
        storedImagePaths,
        addMessage,
      );

      // Stream tokens directly into the current session's messages
      const handleChunk = (data: any) => {
        if (!session?.id) return;
        // Grow the visible assistant message by type
        useStore
          .getState()
          .upsertStreamingAssistantMessage(session.id, data.type, data.chunk);
      };
      setupStreaming(handleChunk);

      try {
        const existingMessages = currentSession?.messages
          ? [...currentSession.messages]
          : [];
        const history = existingMessages.concat([newMessage]);

        await window.electronAPI.streamMessageWithHistory(
          history,
          {
            rag: isRAGEnabled,
          },
          settings.openrouterApiKey,
        );
        // Persist what we received into DB so it's not ephemeral
        await persistStreamingSegments(segmentsRef.current, session);
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
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left column: messages + input */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {currentSession && currentSession?.messages?.length > 0 ? (
          <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-4 hide-scrollbar">
            <MessageGroups
              messages={currentSession.messages}
              onOpenDetails={openSidebar}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-2xl mb-4 text-blue-700">
              👋 How can I help you ?
            </h1>
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

      {/* Right column: sidebar */}
      {currentSession && currentSession?.messages?.length > 0 && (
        <MessageDetailsSidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          plans={sidebarPlans}
          logs={sidebarLogs}
          sources={sidebarSources}
        />
      )}
    </div>
  );
}
