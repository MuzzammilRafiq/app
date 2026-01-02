import { useState, useEffect, useRef, useCallback } from "react";
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
import { CommandConfirmationDialog } from "../CommandConfirmationDialog";

export default function ChatContainer() {
  const currentSession = useStore(
    (s) => s.currentSession
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

  // Command confirmation dialog state
  const [pendingCommand, setPendingCommand] = useState<{
    command: string;
    requestId: string;
    cwd: string;
  } | null>(null);

  const { isStreaming, segmentsRef, setupStreaming, cleanupStreaming } =
    useStreaming();

  // Listen for terminal command confirmation requests
  useEffect(() => {
    const handleConfirmationRequest = (data: {
      command: string;
      requestId: string;
      cwd: string;
    }) => {
      setPendingCommand(data);
    };

    window.electronAPI.onCommandConfirmation(handleConfirmationRequest);

    return () => {
      window.electronAPI.removeCommandConfirmationListener();
    };
  }, []);

  const handleAllowCommand = useCallback((requestId: string) => {
    window.electronAPI.respondToCommandConfirmation(requestId, true);
    setPendingCommand(null);
  }, []);

  const handleDenyCommand = useCallback((requestId: string) => {
    window.electronAPI.respondToCommandConfirmation(requestId, false);
    setPendingCommand(null);
  }, []);

  const resetInputState = () => {
    setContent("");
    setImagePaths(null);
    setSelectedImage(null);
  };

  const djb2Hash = (str: string): string => {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  };

  const buildSyntheticPlanFromDB = async (
    plans: ChatMessageRecord[]
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
        planHash
      );
      if (Array.isArray(dbSteps) && dbSteps.length > 0) {
        const merged = steps.map((s: any) => {
          const matched = dbSteps.find(
            (d: any) => Number(d.step_number) === Number(s.step_number)
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

  const openSidebar = (payload: {
    plans: ChatMessageRecord[];
    logs: ChatMessageRecord[];
    sources: ChatMessageRecord[];
  }) => {
    const immediate = buildSyntheticPlan(
      payload.plans || [],
      payload.logs || []
    );
    setSidebarPlans(immediate);
    void (async () => {
      const fromDb = await buildSyntheticPlanFromDB(payload.plans || []);
      if (fromDb.length > 0) setSidebarPlans(fromDb);
    })();
    setSidebarLogs(payload.logs || []);
    setSidebarSources(payload.sources || []);
    setSidebarOpen(true);
  };
  const closeSidebar = () => setSidebarOpen(false);

  // Auto-open sidebar when new assistant details arrive
  const prevCountRef = useRef(0);
  const messages = (currentSession?.messages ?? []) as ChatMessageRecord[];

  const buildSyntheticPlan = (
    plans: ChatMessageRecord[],
    logs: ChatMessageRecord[]
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

  useEffect(() => {
    const currLen = currentSession?.messages?.length ?? 0;
    prevCountRef.current = currLen;
    setHasAutoOpened(false);
    const { plans, logs, sources } = computeLastAssistantGroup();
    const immediate = buildSyntheticPlan(plans, logs);
    setSidebarPlans(immediate);
    setSidebarLogs(logs);
    setSidebarSources(sources);
    void (async () => {
      const fromDb = await buildSyntheticPlanFromDB(plans);
      if (fromDb.length > 0) setSidebarPlans(fromDb);
    })();
    if (!currentSession?.id) {
      setSidebarPlans([]);
      setSidebarLogs([]);
      setSidebarSources([]);
    }
  }, [currentSession?.id]);

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
      if (!sidebarOpen) setSidebarOpen(true);
      const immediate = buildSyntheticPlan(plans, logs);
      setSidebarPlans(immediate);
      setSidebarLogs(logs);
      setSidebarSources(sources);
      void (async () => {
        const fromDb = await buildSyntheticPlanFromDB(plans);
        if (fromDb.length > 0) setSidebarPlans(fromDb);
        setHasAutoOpened(true);
      })();
    } else if (hasDetails && sidebarOpen) {
      // Keep sidebar content in sync if it's already open
      const immediate = buildSyntheticPlan(plans, logs);
      setSidebarPlans(immediate);
      setSidebarLogs(logs);
      setSidebarSources(sources);
      void (async () => {
        const fromDb = await buildSyntheticPlanFromDB(plans);
        if (fromDb.length > 0) setSidebarPlans(fromDb);
      })();
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
        createNewSession
      );
      const storedImagePaths = await handleImagePersistence(
        selectedImage,
        imagePaths
      );
      const newMessage = await createUserMessage(
        session,
        trimmedContent || "",
        storedImagePaths,
        addMessage
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
            webSearch: isWebSearchEnabled,
            textModelOverride: settings.textModel || "",
            imageModelOverride: settings.imageModel || "",
          },
          settings.openrouterApiKey
        );

        // FIX #5: Persist streaming segments and replace ephemeral messages
        const ephemeralCount = segmentsRef.current.length;
        const persistedRecords = await persistStreamingSegments(
          segmentsRef.current,
          session
        );

        // Replace ephemeral messages in store with persisted records
        if (persistedRecords.length > 0 && session?.id) {
          useStore
            .getState()
            .replaceStreamingMessages(
              session.id,
              persistedRecords,
              ephemeralCount
            );
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
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left column: messages + input */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
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

      {/* Command confirmation dialog */}
      <CommandConfirmationDialog
        isOpen={!!pendingCommand}
        command={pendingCommand?.command ?? ""}
        cwd={pendingCommand?.cwd ?? ""}
        requestId={pendingCommand?.requestId ?? ""}
        onAllow={handleAllowCommand}
        onDeny={handleDenyCommand}
      />
    </div>
  );
}
