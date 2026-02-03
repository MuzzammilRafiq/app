import { MarkdownRenderer } from "./markdown-renderer";
import {
  TerminalConfirmationRenderer,
  PlanRenderer,
  LogRenderer,
  SourceRenderer,
  GeneralRenderer,
} from "./renderers";
import type { ChatMessageRecord, UniqueResult } from "../../../../common/types";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useRef, useEffect, memo, useMemo, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "../../../components/icons";
import clsx from "clsx";

interface MessageGroup {
  id: string; // Unique stable ID for the group
  userMessage: ChatMessageRecord | null;
  assistantMessages: ChatMessageRecord[];
}

interface MessageGroupsProps {
  messages: ChatMessageRecord[];
  isStreaming?: boolean; // To hint auto-scroll behavior
  onAllowCommand?: (requestId: string) => void;
  onRejectCommand?: (requestId: string) => void;
}

function groupMessages(messages: ChatMessageRecord[]): MessageGroup[] {
  const groupedMessages: MessageGroup[] = [];
  let currentGroup: MessageGroup = {
    id: "temp-start",
    userMessage: null,
    assistantMessages: [],
  };

  for (const message of messages) {
    if (message.role === "user") {
      // Start new group with user message
      if (
        currentGroup.userMessage ||
        currentGroup.assistantMessages.length > 0
      ) {
        // Generate a stable-ish ID based on the user message ID
        currentGroup.id =
          currentGroup.userMessage?.id ||
          `group-auto-${groupedMessages.length}`;
        groupedMessages.push(currentGroup);
      }
      currentGroup = {
        id: message.id, // Use user message ID as group ID
        userMessage: message,
        assistantMessages: [],
      };
    } else {
      // Add assistant message to current group
      currentGroup.assistantMessages.push(message);
    }
  }

  // Add final group if it has content
  if (currentGroup.userMessage || currentGroup.assistantMessages.length > 0) {
    if (!currentGroup.userMessage && groupedMessages.length > 0) {
      // Orphan assistant messages (system prompt outputs etc) - append to previous group if possible or new
      // For simplicity, just push as new group
      currentGroup.id =
        currentGroup.assistantMessages[0]?.id || `group-end-${Date.now()}`;
    } else if (currentGroup.userMessage) {
      currentGroup.id = currentGroup.userMessage.id;
    }
    groupedMessages.push(currentGroup);
  }

  return groupedMessages;
}

// Search status type from backend
interface SearchStatus {
  phase:
    | "generating"
    | "searching"
    | "processing"
    | "extracting"
    | "complete"
    | "error";
  message: string;
}

// Parse search-status event from backend
function parseSearchStatus(content: string): SearchStatus | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.phase && parsed.message) {
      return parsed as SearchStatus;
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

interface WebSource {
  url: string;
  title: string;
}

interface TerminalConfirmationData {
  command: string;
  cwd: string;
  requestId: string;
  status: "pending" | "allowed" | "rejected";
}

function parseTerminalConfirmation(
  content: string,
): TerminalConfirmationData | null {
  try {
    const parsed = JSON.parse(content);
    if (
      parsed &&
      typeof parsed.command === "string" &&
      typeof parsed.cwd === "string" &&
      typeof parsed.requestId === "string" &&
      typeof parsed.status === "string"
    ) {
      return parsed as TerminalConfirmationData;
    }
  } catch {
    // ignore
  }
  return null;
}

function parseRagSources(content: string): UniqueResult[] | null {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      const ragSources = data.filter(
        (d: any) =>
          d &&
          typeof d.id === "string" &&
          typeof d.document === "string" &&
          d.metadata &&
          typeof d.metadata.path === "string" &&
          typeof d.metadata.index === "number",
      );
      return ragSources.length > 0 ? (ragSources as UniqueResult[]) : null;
    }
  } catch {
    // ignore
  }
  return null;
}

function parseWebSources(content: string): WebSource[] | null {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      const webSources = data.filter(
        (d: any) =>
          d && typeof d.url === "string" && typeof d.title === "string",
      );
      return webSources.length > 0 ? (webSources as WebSource[]) : null;
    }
  } catch {
    // ignore
  }
  return null;
}

function mergeLogs(logMessages: ChatMessageRecord[]): string {
  if (logMessages.length === 0) return "";
  if (logMessages.length === 1) return logMessages[0]?.content ?? "";
  return logMessages
    .map((msg, index) => {
      const header = `----- log ${index + 1}/${logMessages.length} -----`;
      return `${header}\n${msg.content}`;
    })
    .join("\n\n");
}

function mergeSources(sourceMessages: ChatMessageRecord[]): {
  ragJson?: string;
  webJson?: string;
  raw?: string[];
} {
  const ragById = new Map<string, UniqueResult>();
  const webByUrl = new Map<string, WebSource>();
  const raw: string[] = [];

  for (const msg of sourceMessages) {
    const rag = parseRagSources(msg.content);
    if (rag && rag.length > 0) {
      for (const s of rag) {
        const key = s.id || `${s.metadata?.path ?? ""}:${s.metadata?.index}`;
        if (!ragById.has(key)) ragById.set(key, s);
      }
      continue;
    }
    const web = parseWebSources(msg.content);
    if (web && web.length > 0) {
      for (const s of web) {
        if (!webByUrl.has(s.url)) webByUrl.set(s.url, s);
      }
      continue;
    }
    raw.push(msg.content);
  }

  const ragJson =
    ragById.size > 0 ? JSON.stringify(Array.from(ragById.values())) : undefined;
  const webJson =
    webByUrl.size > 0 ? JSON.stringify(Array.from(webByUrl.values())) : undefined;

  return {
    ragJson,
    webJson,
    raw: raw.length > 0 ? raw : undefined,
  };
}

const djb2Hash = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

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
  } catch {}
  return plans;
};

// Animated searching indicator for web search
function SearchingIndicator({ status }: { status: SearchStatus }) {
  // Don't show indicator for complete or error phases
  if (status.phase === "complete" || status.phase === "error") {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
      {/* Animated spinner + search icon */}
      <div className="relative">
        <svg
          className="w-5 h-5 text-blue-600 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <svg
          className="w-3 h-3 text-blue-700 absolute -right-0.5 -bottom-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-blue-800">
          Searching the web...
        </span>
        <span className="text-xs text-blue-600/80">{status.message}</span>
      </div>
    </div>
  );
}

function AssistantMessageSection({
  messages,
  isStreaming,
  open,
  onAllowCommand,
  onRejectCommand,
}: {
  messages: ChatMessageRecord[];
  isStreaming?: boolean;
  open: boolean;
  onAllowCommand?: (requestId: string) => void;
  onRejectCommand?: (requestId: string) => void;
}) {
  const planMessages = useMemo(
    () => messages.filter((msg) => msg.type === "plan"),
    [messages],
  );
  const logMessages = useMemo(
    () => messages.filter((msg) => msg.type === "log"),
    [messages],
  );
  const sourceMessages = useMemo(
    () => messages.filter((msg) => msg.type === "source"),
    [messages],
  );
  const terminalMessages = useMemo(
    () => messages.filter((msg) => msg.type === "terminal-confirmation"),
    [messages],
  );
  const primaryMessages = useMemo(
    () =>
      messages.filter(
        (msg) =>
          msg.type !== "plan" &&
          msg.type !== "log" &&
          msg.type !== "source" &&
          msg.type !== "terminal-confirmation" &&
          msg.type !== "search-status",
      ),
    [messages],
  );
  const searchStatusMessages = useMemo(
    () => messages.filter((msg) => msg.type === "search-status"),
    [messages],
  );

  // Get the latest search status (if still active)
  const latestSearchStatusContent =
    searchStatusMessages[searchStatusMessages.length - 1]?.content;
  const searchStatus =
    isStreaming && latestSearchStatusContent
      ? parseSearchStatus(latestSearchStatusContent)
      : null;

  const [planDisplayMessages, setPlanDisplayMessages] = useState<
    ChatMessageRecord[]
  >([]);
  useEffect(() => {
    if (planMessages.length === 0) {
      setPlanDisplayMessages([]);
      return;
    }
    const immediate = buildSyntheticPlan(planMessages, logMessages);
    setPlanDisplayMessages(immediate);
    let isActive = true;
    void (async () => {
      const fromDb = await buildSyntheticPlanFromDB(planMessages);
      if (!isActive) return;
      if (fromDb.length > 0) setPlanDisplayMessages(fromDb);
    })();
    return () => {
      isActive = false;
    };
  }, [planMessages, logMessages]);

  const planDisplayMap = useMemo(() => {
    const map = new Map<string, ChatMessageRecord>();
    for (const msg of planDisplayMessages) {
      map.set(msg.id, msg);
    }
    return map;
  }, [planDisplayMessages]);

  const orderedDisplayMessages = useMemo(() => {
    if (!primaryMessages.length) return [] as ChatMessageRecord[];
    return primaryMessages.map((msg) =>
      msg.type === "plan" ? (planDisplayMap.get(msg.id) ?? msg) : msg,
    );
  }, [primaryMessages, planDisplayMap]);

  const mergedLogContent = useMemo(
    () => mergeLogs(logMessages),
    [logMessages],
  );
  const mergedSources = useMemo(
    () => mergeSources(sourceMessages),
    [sourceMessages],
  );
  const hasDetails =
    terminalMessages.length +
      planDisplayMessages.length +
      logMessages.length +
      sourceMessages.length >
    0;
  const hasPendingTerminal = useMemo(
    () =>
      terminalMessages.some((m) => {
        const data = parseTerminalConfirmation(m.content);
        return data?.status === "pending";
      }),
    [terminalMessages],
  );

  const detailsCounts = useMemo(
    () => ({
      terminal: terminalMessages.length,
      plan: planDisplayMessages.length,
      logs: logMessages.length,
      sources: sourceMessages.length,
    }),
    [
      terminalMessages.length,
      planDisplayMessages.length,
      logMessages.length,
      sourceMessages.length,
    ],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Messages Wrapper */}
      <div className="w-full text-text-main space-y-4">
        {/* Web Search Indicator - shown prominently when searching */}
        {searchStatus && <SearchingIndicator status={searchStatus} />}

        {/* Stream and Terminal Confirmation messages - rendered chronologically */}
        {hasDetails && (
          <TurnDetails
            globalOpen={open}
            hasPendingTerminal={hasPendingTerminal}
            counts={detailsCounts}
          >
            {terminalMessages.length > 0 && (
              <div className="space-y-2">
                {terminalMessages.map((msg) => (
                  <TerminalConfirmationRenderer
                    key={msg.id}
                    content={msg.content}
                    onAllow={onAllowCommand}
                    onReject={onRejectCommand}
                  />
                ))}
              </div>
            )}

            {planDisplayMessages.length > 0 && (
              <div className="inline-details-panel">
                <PlanRenderer
                  content={planDisplayMessages[0]?.content ?? ""}
                  open={true}
                />
              </div>
            )}

            {mergedLogContent && (
              <div className="inline-details-panel">
                <LogRenderer content={mergedLogContent} open={true} />
              </div>
            )}

            {mergedSources.ragJson && (
              <div className="inline-details-panel">
                <SourceRenderer content={mergedSources.ragJson} open={true} />
              </div>
            )}
            {mergedSources.webJson && (
              <div className="inline-details-panel">
                <SourceRenderer content={mergedSources.webJson} open={true} />
              </div>
            )}
            {mergedSources.raw && (
              <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-main whitespace-pre-wrap">
                {mergedSources.raw.join("\n\n")}
              </div>
            )}
          </TurnDetails>
        )}

        {orderedDisplayMessages.map((msg) => (
          <div key={msg.id}>
            {msg.type === "general" ? (
              <GeneralRenderer content={msg.content} />
            ) : (
              <div className="prose prose-slate max-w-none leading-relaxed text-[15px] prose-headings:font-semibold prose-a:text-[#3e2723]">
                <MarkdownRenderer content={msg.content} isUser={false} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TurnDetails({
  globalOpen,
  hasPendingTerminal,
  counts,
  children,
}: {
  globalOpen: boolean;
  hasPendingTerminal: boolean;
  counts: { terminal: number; plan: number; logs: number; sources: number };
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(globalOpen || hasPendingTerminal);

  useEffect(() => {
    if (hasPendingTerminal) {
      setIsOpen(true);
      return;
    }
    setIsOpen(globalOpen);
  }, [globalOpen, hasPendingTerminal]);

  const badges: string[] = [];
  if (counts.terminal > 0) badges.push(`Terminal (${counts.terminal})`);
  if (counts.plan > 0) badges.push(`Plan (${counts.plan})`);
  if (counts.logs > 0) badges.push(`Logs (${counts.logs})`);
  if (counts.sources > 0) badges.push(`Sources (${counts.sources})`);

  return (
    <div className="rounded-lg border border-border bg-surface/40">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="text-xs font-semibold text-text-main">
          Details
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="hidden sm:inline">{badges.join(" · ")}</span>
          <ChevronDownIcon
            className={clsx(
              "w-3 h-3 transition-transform duration-200",
              isOpen ? "rotate-180" : "rotate-0",
            )}
          />
        </div>
      </button>
      <div
        className={clsx(
          "transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[80vh] opacity-100 px-3 pb-3" : "max-h-0 opacity-0",
        )}
      >
        <div className="max-h-[80vh] overflow-y-auto pr-1 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function MessageGroups({
  messages,
  isStreaming = false,
  onAllowCommand,
  onRejectCommand,
}: MessageGroupsProps) {
  const groupedMessages = groupMessages(messages);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isAllOpen = false;

  // Auto-scroll effect
  useEffect(() => {
    // If we receive new messages and they are at the end, Virtuoso 'followOutput' handles it.
    // However, fast initial load might need a kick.
    // virtuosoRef.current?.scrollToIndex({ index: groupedMessages.length - 1, align: 'end' });
  }, [groupedMessages.length]);

  return (
    <div className="flex flex-col h-full relative">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: "100%" }} // Must be set to fill container
        data={groupedMessages}
        followOutput={"auto"}
        atBottomThreshold={60} // Pixel threshold to consider "at bottom" for auto-scroll
        initialTopMostItemIndex={groupedMessages.length - 1} // Start at bottom? optional.
        itemContent={(_index, group) => (
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Group Content - Adds spacing via padding instead of margin to play nice with virtualization */}

          {group.userMessage && (
            <div className="flex justify-end pl-12 animate-fade-in mb-6">
              <div
                className="rounded-[20px] rounded-br-sm px-5 py-3 shadow-md max-w-full wrap-break-words"
                style={{
                  backgroundColor: "var(--btn-accent-bg)",
                  color: "var(--btn-accent-text)",
                }}
              >
                {group.userMessage.imagePaths &&
                  group.userMessage.imagePaths.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                      {group.userMessage.imagePaths.map((p, idx) => (
                        <div className="relative" key={idx}>
                          <img
                            src={`file://${p}`}
                            alt="attached image"
                            className="max-w-full max-h-48 rounded-lg border border-primary-light/30"
                            style={{ maxWidth: "200px" }}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).alt =
                                "Failed to load image";
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                <div className="prose prose-sm max-w-none text-white selection:bg-white/30 selection:text-white">
                  <MarkdownRenderer
                    content={group.userMessage.content}
                    isUser={true}
                  />
                </div>
              </div>
            </div>
          )}

          {group.assistantMessages.length > 0 && (
            <div className="animate-fade-in delay-75">
              <AssistantMessageSection
                messages={group.assistantMessages}
                isStreaming={isStreaming}
                open={isAllOpen}
                onAllowCommand={onAllowCommand}
                onRejectCommand={onRejectCommand}
              />
            </div>
          )}
        </div>
      )}
    />
    </div>
  );
}

export default memo(MessageGroups, (prevProps, nextProps) => {
  return (
    prevProps.messages === nextProps.messages &&
    prevProps.isStreaming === nextProps.isStreaming
  );
});
