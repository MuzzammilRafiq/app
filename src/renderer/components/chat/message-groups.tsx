import { MarkdownRenderer } from "./renderers";
import type { ChatMessageRecord } from "../../../common/types";

interface MessageGroup {
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
}

function groupMessages(messages: ChatMessageRecord[]): MessageGroup[] {
  const groupedMessages: MessageGroup[] = [];
  let currentGroup: MessageGroup = {
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
        groupedMessages.push(currentGroup);
      }
      currentGroup = { userMessage: message, assistantMessages: [] };
    } else {
      // Add assistant message to current group
      currentGroup.assistantMessages.push(message);
    }
  }

  // Add final group if it has content
  if (currentGroup.userMessage || currentGroup.assistantMessages.length > 0) {
    groupedMessages.push(currentGroup);
  }

  return groupedMessages;
}

function AssistantMessageSection({
  messages,
  onOpenDetails,
}: {
  messages: ChatMessageRecord[];
  onOpenDetails?: MessageGroupsProps["onOpenDetails"];
}) {
  const planMessages = messages.filter((msg) => msg.type === "plan");
  const logMessages = messages.filter((msg) => msg.type === "log");
  const streamMessages = messages.filter((msg) => msg.type === "stream");
  const sourceMessages = messages.filter((msg) => msg.type === "source");

  return (
    <div className="flex flex-col gap-2">
      {/* Messages Wrapper */}
      <div className="w-full text-slate-800 space-y-4 ">
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
            <MarkdownRenderer content={msg.content} isUser={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MessageGroups({
  messages,
  onOpenDetails,
}: MessageGroupsProps) {
  const groupedMessages = groupMessages(messages);

  return (
    <div className="max-w-3xl mx-auto px-2">
      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-6 mb-8">
          {group.userMessage && (
            <div className="flex justify-end pl-12 animate-fade-in">
              <div className="bg-[#3e2723] text-white rounded-[20px] rounded-br-[4px] px-5 py-3 shadow-md max-w-full break-words">
                {group.userMessage.imagePaths &&
                  group.userMessage.imagePaths.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                      {group.userMessage.imagePaths.map((p, idx) => (
                        <div className="relative" key={idx}>
                          <img
                            src={`file://${p}`}
                            alt="attached image"
                            className="max-w-full max-h-48 rounded-lg border border-[#d7ccc8]/30"
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
                onOpenDetails={onOpenDetails}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
