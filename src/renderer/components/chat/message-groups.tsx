import { PlanRenderer, MarkdownRenderer, LogRenderer, SourceRenderer } from "./renderers";
import type { ChatMessageRecord } from "../../../common/types";

interface MessageGroup {
  userMessage: ChatMessageRecord | null;
  assistantMessages: ChatMessageRecord[];
}

interface MessageGroupsProps {
  messages: ChatMessageRecord[];
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
      if (currentGroup.userMessage || currentGroup.assistantMessages.length > 0) {
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

function AssistantMessageSection({ messages }: { messages: ChatMessageRecord[] }) {
  const planMessages = messages.filter((msg) => msg.type === "plan");
  const logMessages = messages.filter((msg) => msg.type === "log");
  const streamMessages = messages.filter((msg) => msg.type === "stream");
  const sourceMessages = messages.filter((msg) => msg.type === "source");

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] break-words overflow-hidden overflow-wrap-anywhere text-slate-800 px-4 py-2.5 space-y-4">
        {/* Plans */}
        {planMessages.map((msg) => (
          <PlanRenderer key={msg.id} content={msg.content} />
        ))}

        {/* Logs */}
        {logMessages.map((msg) => (
          <div key={msg.id}>
            <LogRenderer content={msg.content} />
          </div>
        ))}

        {/* Stream messages */}
        {streamMessages.map((msg) => (
          <div key={msg.id} className="prose prose-sm max-w-none">
            <MarkdownRenderer content={msg.content} isUser={false} />
          </div>
        ))}

        {/* Sources */}
        {sourceMessages.map((msg) => (
          <div key={msg.id}>
            <SourceRenderer content={msg.content} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MessageGroups({ messages }: MessageGroupsProps) {
  const groupedMessages = groupMessages(messages);

  return (
    <>
      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-4">
          {/* User message */}
          {group.userMessage && (
            <div className="flex justify-end">
              <div className="max-w-[80%] break-words overflow-hidden overflow-wrap-anywhere bg-blue-100 rounded-xl px-2 py-2">
                {group.userMessage.imagePaths && group.userMessage.imagePaths.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-2">
                    {group.userMessage.imagePaths.map((p, idx) => (
                      <div className="relative" key={idx}>
                        <img
                          src={`file://${p}`}
                          alt="attached image"
                          className="max-w-full max-h-48 rounded-xl border border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md"
                          style={{ maxWidth: "200px" }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).alt = "Failed to load image";
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="prose prose-sm max-w-none">
                  <MarkdownRenderer content={group.userMessage.content} isUser={true} />
                </div>
              </div>
            </div>
          )}

          {/* Assistant messages */}
          {group.assistantMessages.length > 0 && <AssistantMessageSection messages={group.assistantMessages} />}
        </div>
      ))}
    </>
  );
}
