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
    <div className="flex justify-start">
      <div className="w-[80%] break-words overflow-hidden overflow-wrap-anywhere text-slate-800 px-4 py-2.5 space-y-4">
        {/* Single Details button */}
        {(planMessages.length > 0 ||
          logMessages.length > 0 ||
          sourceMessages.length > 0) && (
          <div>
            <button
              onClick={() =>
                onOpenDetails &&
                onOpenDetails({
                  plans: planMessages,
                  logs: logMessages,
                  sources: sourceMessages,
                })
              }
              className="cursor-pointer text-[11px] px-0 py-0 bg-transparent border-0 text-blue-600 hover:text-blue-700 hover:underline underline-offset-2 focus:outline-none focus:ring-0 opacity-90 hover:opacity-100"
            >
              Details
            </button>
          </div>
        )}

        {/* Stream messages - keep inline */}
        {streamMessages.map((msg) => (
          <div key={msg.id} className="prose prose-sm max-w-none">
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
    <>
      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-4">
          {group.userMessage && (
            <div className="flex justify-end">
              <div className="max-w-[80%] break-words overflow-hidden overflow-wrap-anywhere bg-blue-100 rounded-xl px-2 py-2">
                {group.userMessage.imagePaths &&
                  group.userMessage.imagePaths.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-2">
                      {group.userMessage.imagePaths.map((p, idx) => (
                        <div className="relative" key={idx}>
                          <img
                            src={`file://${p}`}
                            alt="attached image"
                            className="max-w-full max-h-48 rounded-xl border border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md"
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
                <div className="prose prose-sm max-w-none">
                  <MarkdownRenderer
                    content={group.userMessage.content}
                    isUser={true}
                  />
                </div>
              </div>
            </div>
          )}

          {group.assistantMessages.length > 0 && (
            <AssistantMessageSection
              messages={group.assistantMessages}
              onOpenDetails={onOpenDetails}
            />
          )}
        </div>
      ))}
    </>
  );
}
