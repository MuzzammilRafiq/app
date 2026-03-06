import { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";

import {
  useStore,
  useSessionId,
  useSessionMessages,
  useChatSessions,
  useStreamingStore,
} from "../../utils/store";
import { type ImageData } from "../../utils/image";
import type { ChatMessageRecord } from "../../../common/types";
import ChatInput from "./_components/input";
import MessageGroups from "./_components/message-groups";
import { useStreaming } from "./_components/streaming";
import {
  handleImagePersistence,
  ensureSession,
  createUserMessage,
  persistStreamingSegments,
  type ChatSession,
} from "../../utils/chat";
import { loadSettings } from "../../utils/localstore";
import EmptyPanel from "./_components/emptypanel";

const EMPTY_SESSION_STREAMING_SEGMENTS: Array<{
  id: string;
  type: ChatMessageRecord["type"];
  content: string;
  sessionId: string;
  requestId: string;
}> = [];

export default function ChatScreen() {
  const sessionId = useSessionId();
  useSessionMessages();
  const chatSessions = useChatSessions();
  const currentSession = chatSessions.find(
    (s) => s.id === sessionId,
  ) as ChatSession | null;
  const addMessage = useStore((s) => s.addMessage);
  const createNewSession = useStore((s) => s.createNewSession);

  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isRAGEnabled, setIsRAGEnabled] = useState(false);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);

  const { setupStreaming, cleanupStreaming } = useStreaming();
  const isCurrentSessionStreaming = useStreamingStore((s) =>
    currentSession?.id
      ? Boolean(s.activeRequestIdsBySession[currentSession.id])
      : false,
  );
  const currentSessionRequestId = useStreamingStore((s) =>
    currentSession?.id ? s.activeRequestIdsBySession[currentSession.id] : null,
  );
  const sessionStreamingSegments = useStreamingStore(
    (s) =>
      currentSession?.id
        ? (s.streamingSegmentsBySession[currentSession.id] ??
          EMPTY_SESSION_STREAMING_SEGMENTS)
        : EMPTY_SESSION_STREAMING_SEGMENTS,
  );

  // Listen for terminal command confirmation requests
  useEffect(() => {
    const handleConfirmationRequest = (data: {
      command: string;
      requestId: string;
      sessionId: string;
      streamRequestId: string;
      cwd: string;
    }) => {
      // Add confirmation message to streaming segments
      useStreamingStore.getState().addStreamingChunk(
        {
          chunk: JSON.stringify({
            command: data.command,
            cwd: data.cwd,
            requestId: data.requestId,
            sessionId: data.sessionId,
            streamRequestId: data.streamRequestId,
            status: "pending",
          }),
          type: "terminal-confirmation",
          sessionId: data.sessionId,
          requestId: data.streamRequestId,
        },
      );
    };

    return window.electronAPI.onCommandConfirmation(handleConfirmationRequest);
  }, []);

  const handleAllowCommand = useCallback(
    (requestId: string) => {
      window.electronAPI.respondToCommandConfirmation(requestId, true);

      // Find and update the confirmation segment
      const confirmationSegment = sessionStreamingSegments.find((seg) => {
        if (seg.type === "terminal-confirmation") {
          try {
            const data = JSON.parse(seg.content);
            return data.requestId === requestId;
          } catch {}
        }
        return false;
      });

      if (confirmationSegment) {
        const data = JSON.parse(confirmationSegment.content);
        useStreamingStore
          .getState()
          .updateStreamingSegment(
            confirmationSegment.id,
            JSON.stringify({ ...data, status: "allowed" }),
          );
      }
    },
    [sessionStreamingSegments],
  );

  const handleDenyCommand = useCallback(
    (requestId: string) => {
      window.electronAPI.respondToCommandConfirmation(requestId, false);

      // Find and update the confirmation segment
      const confirmationSegment = sessionStreamingSegments.find((seg) => {
        if (seg.type === "terminal-confirmation") {
          try {
            const data = JSON.parse(seg.content);
            return data.requestId === requestId;
          } catch {}
        }
        return false;
      });

      if (confirmationSegment) {
        const data = JSON.parse(confirmationSegment.content);
        useStreamingStore
          .getState()
          .updateStreamingSegment(
            confirmationSegment.id,
            JSON.stringify({ ...data, status: "rejected" }),
          );
      }
    },
    [sessionStreamingSegments],
  );

  const resetInputState = useCallback(() => {
    setContent("");
    setImagePaths(null);
    setSelectedImage(null);
  }, []);

  const handleSendMessage = useCallback(async () => {
    const settings = loadSettings();
    if (!settings.openrouterApiKey) {
      toast.error("OpenRouter API key not found in settings");
      return;
    }
    const trimmedContent = content.trim();
    const hasAnyImage =
      !!selectedImage || (imagePaths && imagePaths.length > 0);
    if ((!trimmedContent && !hasAnyImage) || isCurrentSessionStreaming) {
      if (isCurrentSessionStreaming) {
        toast.error(
          "A chat run is already in progress. Cancel it before starting a new one.",
        );
      }
      return;
    }

    console.log("Sending message:", {
      trimmedContent,
      hasImage: !!selectedImage,
      sessionId: currentSession?.id,
    });

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

      const existingMessages = currentSession?.messages
        ? [...currentSession.messages]
        : [];
      const history = existingMessages.concat([newMessage]);
      const requestId = crypto.randomUUID();

      setupStreaming(session.id, requestId);

      try {
        const streamResponse =
          await window.electronAPI.streamMessageWithHistory(
            history,
            {
              rag: isRAGEnabled,
              webSearch: isWebSearchEnabled,
              textModelOverride: settings.textModel || "",
              imageModelOverride: settings.imageModel || "",
            },
            settings.openrouterApiKey,
            requestId,
          );

        if (streamResponse?.error === "Chat stream already in progress") {
          toast.error(
            "A chat run is already in progress. Cancel it before starting a new one.",
          );
          return;
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });

        if (streamResponse?.text?.trim()) {
          useStreamingStore
            .getState()
            .reconcileFinalResponse(session.id, requestId, streamResponse.text);
        }

        // Persist streaming segments from the streaming store
        const streamingSegments = useStreamingStore
          .getState()
          .streamingSegments.filter(
            (seg) =>
              seg.sessionId === session.id && seg.requestId === requestId,
          );
        const persistedRecords = await persistStreamingSegments(
          streamingSegments,
          session,
        );

        // Add persisted messages to the store
        for (const record of persistedRecords) {
          const updatedSession = await window.electronAPI.dbGetSession(
            session.id,
          );
          if (updatedSession) {
            addMessage(record, updatedSession);
          }
        }
      } catch (streamErr) {
        console.error("Streaming error:", streamErr);
        toast.error("Streaming failed");
      } finally {
        cleanupStreaming(session.id, requestId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  }, [
    content,
    selectedImage,
    imagePaths,
    isCurrentSessionStreaming,
    currentSession,
    isRAGEnabled,
    isWebSearchEnabled,
    setupStreaming,
    cleanupStreaming,
    addMessage,
    resetInputState,
  ]);

  const handleStopGeneration = useCallback(async () => {
    if (!currentSession?.id) {
      return;
    }

    try {
      const streamingSegments = useStreamingStore
        .getState()
        .streamingSegments.filter(
          (seg) => seg.sessionId && seg.sessionId === currentSession.id,
        );
      const streamChunks = streamingSegments.filter(
        (seg) => seg.type === "stream",
      );
      if (streamChunks.length > 0) {
        const persistedRecords = await persistStreamingSegments(
          streamChunks,
          currentSession,
          { typeOverride: "cancelled", appendContent: "Cancelled by user" },
        );

        for (const record of persistedRecords) {
          const updatedSession = await window.electronAPI.dbGetSession(
            currentSession.id,
          );
          if (updatedSession) {
            addMessage(record, updatedSession);
          }
        }
      } else {
        const record: ChatMessageRecord = {
          id: crypto.randomUUID(),
          sessionId: currentSession.id,
          content: "Cancelled by user",
          role: "assistant",
          timestamp: Date.now(),
          isError: "",
          imagePaths: null,
          type: "cancelled",
        };
        const saved = await window.electronAPI.dbAddChatMessage(record);
        const updatedSession = await window.electronAPI.dbGetSession(
          currentSession.id,
        );
        if (updatedSession) {
          addMessage(saved, updatedSession);
        }
      }

      await window.electronAPI.cancelStream(currentSession.id);
      toast.success("Generation stopped");
    } catch (err) {
      console.error("Failed to stop generation:", err);
      toast.error("Failed to stop generation");
    } finally {
      cleanupStreaming(currentSession.id, currentSessionRequestId ?? "");
    }
  }, [
    currentSession,
    currentSessionRequestId,
    addMessage,
    cleanupStreaming,
    sessionStreamingSegments,
  ]);

  // Memoize messages array to prevent unnecessary re-renders
  // Streaming segments are appended in insertion order (backend sends sequentially)
  const allMessages = useMemo(
    () => [
      ...(currentSession?.messages || []),
      ...sessionStreamingSegments.map(
        (seg): ChatMessageRecord => ({
          id: seg.id,
          sessionId: seg.sessionId,
          content: seg.content,
          role: "assistant",
          timestamp: Date.now(),
          isError: "",
          imagePaths: null,
          type: seg.type,
        }),
      ),
    ],
    [currentSession?.messages, sessionStreamingSegments, currentSession?.id],
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left column: messages + input */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {(currentSession?.messages?.length ?? 0) > 0 ||
        isCurrentSessionStreaming ||
        sessionStreamingSegments.length > 0 ? (
          <div className="flex-1 min-h-0">
            <MessageGroups
              messages={allMessages}
              isStreaming={isCurrentSessionStreaming}
              onAllowCommand={handleAllowCommand}
              onRejectCommand={handleDenyCommand}
            />
          </div>
        ) : (
          <EmptyPanel />
        )}

        <ChatInput
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          imagePaths={imagePaths}
          setImagePaths={setImagePaths}
          content={content}
          setContent={setContent}
          isLoading={isCurrentSessionStreaming}
          isStreaming={isCurrentSessionStreaming}
          handleSendMessage={handleSendMessage}
          handleStopGeneration={handleStopGeneration}
          isRAGEnabled={isRAGEnabled}
          setIsRAGEnabled={setIsRAGEnabled}
          isWebSearchEnabled={isWebSearchEnabled}
          setIsWebSearchEnabled={setIsWebSearchEnabled}
        />
      </div>
    </div>
  );
}
