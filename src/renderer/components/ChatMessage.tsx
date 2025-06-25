import type { ChatMessage as ChatMessageType } from "../services/geminiService";

export default function ChatMessage(message: ChatMessageType) {
  const isUser = message.role === "user";
  const isError = message.isError;
  const isStreaming = !isUser && !isError && message.content === "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[70%] px-4 py-3 rounded-lg ${
          isUser
            ? "bg-blue-600 text-white rounded-br-none"
            : isError
            ? "bg-red-100 text-red-800 border border-red-300 rounded-bl-none"
            : "bg-gray-200 text-gray-800 rounded-bl-none"
        }`}
      >
        {isStreaming ? (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
            <span className="text-gray-600 text-sm">AI is typing...</span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}

        <div
          className={`text-xs mt-2 opacity-70 ${isUser ? "text-blue-100" : isError ? "text-red-600" : "text-gray-500"}`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
