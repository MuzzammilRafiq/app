import type { ChatMessageRecord } from "../../../common/types";
import { MarkdownRenderer, PlanRenderer, LogRenderer } from "./renderers";
import clsx from "clsx";
export default function ChatMessage(message: ChatMessageRecord) {
  const isUser = message.role === "user";
  const isError = message.isError;
  const isStreaming = !isUser && !isError && message.content === "";
  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[80%] break-words overflow-hidden overflow-wrap-anywhere",
          isUser
            ? "bg-blue-100 rounded-xl px-2 py-2"
            : isError
              ? "bg-gradient-to-br from-red-50 to-red-100 text-red-800 border-red-200 px-4 py-2.5"
              : "text-slate-800 px-4 py-2.5"
        )}
      >
        {isStreaming ? (
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {message?.imagePaths && message.imagePaths.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {message.imagePaths.map((p, idx) => (
                  <div className="relative" key={idx}>
                    <img
                      src={`file://${p}`}
                      alt={"attached image"}
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

            {(() => {
              switch (message.type) {
                case "plan":
                  return <PlanRenderer content={message.content} />;
                case "log":
                  return <LogRenderer content={message.content} />;
                case "stream":
                  return <MarkdownRenderer content={message.content} isUser={message.role === "user"} />;
                case "user":
                  return <MarkdownRenderer content={message.content} isUser={message.role === "user"} />;
                default:
                  return <div>Can't render message, check errors</div>;
              }
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
