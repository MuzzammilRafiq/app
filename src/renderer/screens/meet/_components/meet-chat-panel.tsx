import type { MeetChatSessionWithMessages } from "../../../../common/types";

interface MeetChatPanelProps {
  session: MeetChatSessionWithMessages | null;
  isLoading: boolean;
  error: string | null;
  isRecording: boolean;
}

function getStatusLabel(
  status: MeetChatSessionWithMessages["status"] | undefined,
  isRecording: boolean,
): string {
  if (status === "processing") {
    return "Processing";
  }
  if (status === "responded") {
    return "Responded";
  }
  if (status === "error") {
    return "Error";
  }
  return isRecording ? "Listening" : "Idle";
}

export default function MeetChatPanel({
  session,
  isLoading,
  error,
  isRecording,
}: MeetChatPanelProps) {
  const messages = session?.messages ?? [];
  const hasMessages = messages.length > 0;
  const statusLabel = getStatusLabel(session?.status, isRecording);

  return (
    <aside className="flex min-h-0 w-full flex-col rounded-2xl border border-border/50 bg-surface/60 shadow-sm xl:max-w-[24rem]">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-text-main">Chat</h3>
          <p className="mt-1 text-sm text-text-muted">
            Runs when completed transcript explicitly addresses chat.
          </p>
        </div>
        <span className="rounded-full border border-border bg-bg-app px-3 py-1 text-xs font-medium text-text-muted">
          {statusLabel}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!hasMessages && (
          <div className="rounded-2xl border border-dashed border-border bg-bg-app/70 px-4 py-5 text-sm leading-6 text-text-muted">
            {isLoading
              ? "Loading Meet Chat session..."
              : 'Say "chat" as part of a completed request, for example "chat what does previous sentence mean?"'}
          </div>
        )}

        <div className="space-y-3">
          {messages.map((message) =>
            message.type === "response" ? (
              <div
                key={message.id}
                className="rounded-2xl border border-border bg-bg-app px-4 py-3 text-sm leading-6 text-text-main"
              >
                {message.content}
              </div>
            ) : (
              <div
                key={message.id}
                className="rounded-xl bg-bg-app/80 px-3 py-2 text-xs leading-5 text-text-muted"
              >
                {message.content}
              </div>
            ),
          )}
        </div>
      </div>

      <div className="border-t border-border/60 px-5 py-3 text-xs text-text-muted">
        {session?.lastQuery
          ? `Last query: ${session.lastQuery}`
          : 'Meet Chat only responds when completed transcript explicitly addresses "chat".'}
      </div>
    </aside>
  );
}