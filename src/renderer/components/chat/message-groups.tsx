import { WorkerMarkdownRenderer } from "./worker-renderers";
import type { ChatMessageRecord } from "../../../common/types";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useRef, useEffect, memo } from "react";

interface MessageGroup {
  id: string; // Unique stable ID for the group
  userMessage: ChatMessageRecord | null;
  assistantMessages: ChatMessageRecord[];
}

interface MessageGroupsProps {
  messages: ChatMessageRecord[];
  onOpenDetails?: (payload: {
    plans: ChatMessageRecord[];
    logs: ChatMessageRecord[];
    sources: ChatMessageRecord[];
  }) => void;
  isStreaming?: boolean; // To hint auto-scroll behavior
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
  phase: "generating" | "searching" | "processing" | "extracting" | "complete" | "error";
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
  onOpenDetails,
  isStreaming,
}: {
  messages: ChatMessageRecord[];
  onOpenDetails?: MessageGroupsProps["onOpenDetails"];
  isStreaming?: boolean;
}) {
  const planMessages = messages.filter((msg) => msg.type === "plan");
  const logMessages = messages.filter((msg) => msg.type === "log");
  const streamMessages = messages.filter((msg) => msg.type === "stream");
  const sourceMessages = messages.filter((msg) => msg.type === "source");
  const searchStatusMessages = messages.filter((msg) => msg.type === "search-status");

  // Get the latest search status (if still active)
  const latestSearchStatusContent = searchStatusMessages[searchStatusMessages.length - 1]?.content;
  const searchStatus = isStreaming && latestSearchStatusContent
    ? parseSearchStatus(latestSearchStatusContent)
    : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Messages Wrapper */}
      <div className="w-full text-slate-800 space-y-4 ">
        {/* Web Search Indicator - shown prominently when searching */}
        {searchStatus && <SearchingIndicator status={searchStatus} />}

        {/* Detail Toggle for non-chat artifacts */}
        {planMessages.length + logMessages.length + sourceMessages.length >
          0 && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() =>
                onOpenDetails &&
                onOpenDetails({
                  plans: planMessages,
                  logs: logMessages,
                  sources: sourceMessages,
                })
              }
              className="text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-primary transition-colors flex items-center gap-1"
            >
              <span>View Process & Sources</span>
            </button>
          </div>
        )}

        {/* Stream messages - Content */}
        {streamMessages.map((msg) => (
          <div
            key={msg.id}
            className="prose prose-slate max-w-none leading-relaxed text-[15px] prose-headings:font-semibold prose-a:text-[#3e2723]"
          >
            <WorkerMarkdownRenderer
              id={msg.id}
              content={msg.content}
              isUser={false}
              isStreaming={isStreaming}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageGroups({
  messages,
  onOpenDetails,
  isStreaming = false,
}: MessageGroupsProps) {
  const groupedMessages = groupMessages(messages);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Auto-scroll effect
  useEffect(() => {
    // If we receive new messages and they are at the end, Virtuoso 'followOutput' handles it.
    // However, fast initial load might need a kick.
    // virtuosoRef.current?.scrollToIndex({ index: groupedMessages.length - 1, align: 'end' });
  }, [groupedMessages.length]);

  return (
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
              <div className="bg-primary text-white rounded-[20px] rounded-br-[4px] px-5 py-3 shadow-md max-w-full wrap-break-words">
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
                  <WorkerMarkdownRenderer
                    id={group.userMessage.id}
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
                onOpenDetails={onOpenDetails}
                isStreaming={isStreaming}
              />
            </div>
          )}
        </div>
      )}
    />
  );
}

export default memo(MessageGroups, (prevProps, nextProps) => {
  return (
    prevProps.messages === nextProps.messages &&
    prevProps.isStreaming === nextProps.isStreaming
  );
});
