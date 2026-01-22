import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
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
import MessageDetailsSidebar from "./_components/log-panel";
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

export default function ChatScreen() {
  const sessionId = useSessionId();
  const messages = useSessionMessages();
  const chatSessions = useChatSessions();
  const currentSession = chatSessions.find(
    (s) => s.id === sessionId,
  ) as ChatSession | null;
  const addMessage = useStore((s) => s.addMessage);
  const createNewSession = useStore((s) => s.createNewSession);

  const [isLoading, setIsLoading] = useState(false);
  const [imagePaths, setImagePaths] = useState<string[] | null>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isRAGEnabled, setIsRAGEnabled] = useState(false);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPlans, setSidebarPlans] = useState<ChatMessageRecord[]>([]);
  const [sidebarLogs, setSidebarLogs] = useState<ChatMessageRecord[]>([]);
  const [sidebarSources, setSidebarSources] = useState<ChatMessageRecord[]>([]);
  const [autoOpenEnabled] = useState(true);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const { isStreaming, setupStreaming, cleanupStreaming } = useStreaming();
  const streamingSegments = useStreamingStore((s) => s.streamingSegments);

  // Optimization: Only subscribe to changes in Plans, Logs, or Sources for sidebar updates
  const streamingDetailsSegments = useStreamingStore(
    useShallow((s) =>
      s.streamingSegments.filter((seg) =>
        ["plan", "log", "source"].includes(seg.type),
      ),
    ),
  );

  // Listen for terminal command confirmation requests
  useEffect(() => {
    const handleConfirmationRequest = (data: {
      command: string;
      requestId: string;
      cwd: string;
    }) => {
      // Add confirmation message to streaming segments
      useStreamingStore.getState().addStreamingChunk({
        chunk: JSON.stringify({
          command: data.command,
          cwd: data.cwd,
          requestId: data.requestId,
          status: "pending",
        }),
        type: "terminal-confirmation",
      });
    };

    window.electronAPI.onCommandConfirmation(handleConfirmationRequest);

    return () => {
      window.electronAPI.removeCommandConfirmationListener();
    };
  }, []);

  const handleAllowCommand = useCallback(
    (requestId: string) => {
      window.electronAPI.respondToCommandConfirmation(requestId, true);

      // Find and update the confirmation segment
      const confirmationSegment = streamingSegments.find((seg) => {
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
    [streamingSegments],
  );

  const handleDenyCommand = useCallback(
    (requestId: string) => {
      window.electronAPI.respondToCommandConfirmation(requestId, false);

      // Find and update the confirmation segment
      const confirmationSegment = streamingSegments.find((seg) => {
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
    [streamingSegments],
  );

  const resetInputState = useCallback(() => {
    setContent("");
    setImagePaths(null);
    setSelectedImage(null);
  }, []);

  const djb2Hash = (str: string): string => {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  };

  const buildSyntheticPlanFromDB = async (
    plans: ChatMessageRecord[],
  ): Promise<ChatMessageRecord[]> => {
    if (!plans || plans.length === 0) return [];
    const latest = plans[plans.length - 1]!;
    let steps: any[] | null = null;
    try {
      const parsed = JSON.parse(latest.content);
      if (Array.isArray(parsed)) steps = parsed;
      else if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.steps)
      )
        steps = parsed.steps;
    } catch {}
    if (!steps) return plans;
    const normalizedForHash = steps.map((s: any) => ({
      step_number: Number(s.step_number),
      tool_name: s.tool_name,
      description: s.description,
      status: "todo",
    }));
    const planHash = djb2Hash(JSON.stringify(normalizedForHash));
    try {
      const dbSteps = await window.electronAPI.dbGetPlanSteps(
        latest.sessionId,
        planHash,
      );
      if (Array.isArray(dbSteps) && dbSteps.length > 0) {
        const merged = steps.map((s: any) => {
          const matched = dbSteps.find(
            (d: any) => Number(d.step_number) === Number(s.step_number),
          );
          return matched
            ? { ...s, status: matched.status }
            : { ...s, status: s.status ?? "todo" };
        });
        const synthetic: ChatMessageRecord = {
          id: latest.id ?? `synthetic-plan-${Date.now()}`,
          sessionId: latest.sessionId,
          content: JSON.stringify({ steps: merged }, null, 2),
          role: latest.role,
          timestamp: Date.now(),
          isError: "",
          imagePaths: null,
          type: "plan",
        };
        return [synthetic];
      }
    } catch (err) {
      // Silent fallback to log-based synthetic plan
      // eslint-disable-next-line no-console
      console.error("Failed to fetch plan steps from DB:", err);
    }
    return plans;
  };

  const openSidebar = useCallback(
    (payload: {
      plans: ChatMessageRecord[];
      logs: ChatMessageRecord[];
      sources: ChatMessageRecord[];
    }) => {
      const immediate = buildSyntheticPlan(
        payload.plans || [],
        payload.logs || [],
      );
      setSidebarPlans(immediate);
      void (async () => {
        const fromDb = await buildSyntheticPlanFromDB(payload.plans || []);
        if (fromDb.length > 0) setSidebarPlans(fromDb);
      })();
      setSidebarLogs(payload.logs || []);
      setSidebarSources(payload.sources || []);
      setSidebarOpen(true);
    },
    [],
  );
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Auto-open sidebar when new assistant details arrive
  const prevCountRef = useRef(0);

  const buildSyntheticPlan = (
    plans: ChatMessageRecord[],
    logs: ChatMessageRecord[],
  ): ChatMessageRecord[] => {
    if (!plans || plans.length === 0) return [];
    const latest = plans[plans.length - 1]!;
    let steps: any[] | null = null;
    try {
      const parsed = JSON.parse(latest.content);
      if (Array.isArray(parsed)) steps = parsed;
      else if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.steps)
      )
        steps = parsed.steps;
    } catch {}
    if (!steps) return plans;
    // Prefer statuses provided by the plan itself; fall back to logs only if missing.
    const completedFromLogs = new Set<number>();
    const logPatterns = [
      /Step\s+(\d+)\s+completed/i,
      /Step\s+(\d+)\s+done/i,
      /✓\s*Step\s+(\d+)/i,
    ];
    for (const l of logs) {
      for (const re of logPatterns) {
        const m = l.content.match(re);
        if (m) {
          const n = Number(m[1]);
          if (!Number.isNaN(n)) completedFromLogs.add(n);
          break;
        }
      }
    }
    const updated = steps.map((s: any) => {
      const num = Number(s.step_number);
      const statusInPlan = s.status;
      const normalized =
        typeof statusInPlan === "string" ? statusInPlan.toLowerCase() : "";
      const usePlan = normalized === "done" || normalized === "failed";
      const isCompletedByLogs = completedFromLogs.has(num);
      const status = usePlan
        ? normalized
        : isCompletedByLogs
          ? "done"
          : normalized || "todo";
      return { ...s, status };
    });
    const synthetic: ChatMessageRecord = {
      id: latest.id ?? `synthetic-plan-${Date.now()}`,
      sessionId: latest.sessionId,
      content: JSON.stringify({ steps: updated }, null, 2),
      role: latest.role,
      timestamp: Date.now(),
      isError: "",
      imagePaths: null,
      type: "plan",
    };
    return [synthetic];
  };

  const getStreamingMessages = useCallback(() => {
    if (!currentSession?.id) return [];
    const existingIds = new Set(messages.map((m) => m.id));
    return streamingDetailsSegments
      .filter((seg) => !existingIds.has(seg.id))
      .map(
        (seg): ChatMessageRecord => ({
          id: seg.id,
          sessionId: currentSession.id,
          content: seg.content,
          role: "assistant",
          timestamp: Date.now(),
          isError: "",
          imagePaths: null,
          type: seg.type,
        }),
      );
  }, [streamingDetailsSegments, currentSession?.id, messages]);

  const computeLastAssistantGroup = useCallback(() => {
    const allMessages = [...messages, ...getStreamingMessages()];
    if (!allMessages.length)
      return {
        plans: [] as ChatMessageRecord[],
        logs: [] as ChatMessageRecord[],
        sources: [] as ChatMessageRecord[],
      };
    let lastUserIdx = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      if (msg && msg.role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    const assistantGroup = allMessages.slice(lastUserIdx + 1);
    const plans = assistantGroup.filter((m) => m.type === "plan");
    const logs = assistantGroup.filter((m) => m.type === "log");
    const sources = assistantGroup.filter((m) => m.type === "source");
    return { plans, logs, sources };
  }, [messages, getStreamingMessages]);

  useEffect(() => {
    const currLen = currentSession?.messages?.length ?? 0;
    prevCountRef.current = currLen;

    if (!isStreaming) {
      setHasAutoOpened(false);
    }

    const { plans, logs, sources } = computeLastAssistantGroup();
    const immediate = buildSyntheticPlan(plans, logs);
    setSidebarPlans(immediate);
    setSidebarLogs(logs);
    setSidebarSources(sources);

    // Only fetch from DB if not streaming
    if (!isStreaming) {
      void (async () => {
        const fromDb = await buildSyntheticPlanFromDB(plans);
        if (fromDb.length > 0) setSidebarPlans(fromDb);
      })();
    }

    if (!currentSession?.id) {
      setSidebarPlans([]);
      setSidebarLogs([]);
      setSidebarSources([]);
    }
  }, [
    currentSession?.id,
    isStreaming,
    streamingDetailsSegments,
    messages,
    computeLastAssistantGroup,
  ]);

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

    const shouldAutoOpen =
      (isStreaming && !hasAutoOpened && hasDetails) ||
      (!isStreaming &&
        (curr > prev || (!hasAutoOpened && prev === 0 && curr > 0)) &&
        hasDetails);

    if (shouldAutoOpen) {
      if (!sidebarOpen) setSidebarOpen(true);
      if (isStreaming) setHasAutoOpened(true);

      const immediate = buildSyntheticPlan(plans, logs);
      setSidebarPlans(immediate);
      setSidebarLogs(logs);
      setSidebarSources(sources);

      if (!isStreaming) {
        void (async () => {
          const fromDb = await buildSyntheticPlanFromDB(plans);
          if (fromDb.length > 0) setSidebarPlans(fromDb);
          setHasAutoOpened(true);
        })();
      }
    } else if (hasDetails && sidebarOpen) {
      // Keep sidebar content in sync if it's already open
      const immediate = buildSyntheticPlan(plans, logs);
      setSidebarPlans(immediate);
      setSidebarLogs(logs);
      setSidebarSources(sources);

      if (!isStreaming) {
        void (async () => {
          const fromDb = await buildSyntheticPlanFromDB(plans);
          if (fromDb.length > 0) setSidebarPlans(fromDb);
        })();
      }
    }
    prevCountRef.current = curr;
  }, [
    messages,
    autoOpenEnabled,
    sidebarOpen,
    hasAutoOpened,
    isStreaming,
    streamingDetailsSegments,
    computeLastAssistantGroup,
  ]);

  const handleSendMessage = useCallback(async () => {
    const settings = loadSettings();
    if (!settings.openrouterApiKey) {
      toast.error("OpenRouter API key not found in settings");
      return;
    }
    const trimmedContent = content.trim();
    const hasAnyImage =
      !!selectedImage || (imagePaths && imagePaths.length > 0);
    if ((!trimmedContent && !hasAnyImage) || isLoading || isStreaming) {
      if (isLoading || isStreaming) {
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

      const existingMessages = currentSession?.messages
        ? [...currentSession.messages]
        : [];
      const history = existingMessages.concat([newMessage]);

      setupStreaming();

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
          );

        if (streamResponse?.error === "Chat stream already in progress") {
          toast.error(
            "A chat run is already in progress. Cancel it before starting a new one.",
          );
          return;
        }

        // Persist streaming segments from the streaming store
        const streamingSegments =
          useStreamingStore.getState().streamingSegments;
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
        cleanupStreaming();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  }, [
    content,
    selectedImage,
    imagePaths,
    isLoading,
    isStreaming,
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
      const streamingSegments = useStreamingStore.getState().streamingSegments;
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

      await window.electronAPI.cancelStream();
      toast.success("Generation stopped");
    } catch (err) {
      console.error("Failed to stop generation:", err);
      toast.error("Failed to stop generation");
    } finally {
      cleanupStreaming();
    }
  }, [currentSession, addMessage, cleanupStreaming]);

  // Memoize messages array to prevent unnecessary re-renders
  // Streaming segments are appended in insertion order (backend sends sequentially)
  const allMessages = useMemo(
    () => [
      ...(currentSession?.messages || []),
      ...streamingSegments.map(
        (seg): ChatMessageRecord => ({
          id: seg.id,
          sessionId: currentSession?.id || "",
          content: seg.content,
          role: "assistant",
          timestamp: Date.now(),
          isError: "",
          imagePaths: null,
          type: seg.type,
        }),
      ),
    ],
    [currentSession?.messages, streamingSegments, currentSession?.id],
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left column: messages + input */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {(currentSession?.messages?.length ?? 0) > 0 ||
        isStreaming ||
        streamingSegments.length > 0 ? (
          <div className="flex-1 min-h-0">
            <MessageGroups
              messages={allMessages}
              onOpenDetails={openSidebar}
              isStreaming={isStreaming}
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
          isLoading={isLoading}
          isStreaming={isStreaming}
          handleSendMessage={handleSendMessage}
          handleStopGeneration={handleStopGeneration}
          isRAGEnabled={isRAGEnabled}
          setIsRAGEnabled={setIsRAGEnabled}
          isWebSearchEnabled={isWebSearchEnabled}
          setIsWebSearchEnabled={setIsWebSearchEnabled}
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
