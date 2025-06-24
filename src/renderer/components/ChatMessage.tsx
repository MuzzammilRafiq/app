import type { ChatMessage as ChatMessageType } from "../services/geminiService";

export default function ChatMessage(message: ChatMessageType) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[70%] px-4 py-3 rounded-lg ${
          isUser ? "bg-blue-600 text-white rounded-br-none" : "bg-gray-200 text-gray-800 rounded-bl-none"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        <div className={`text-xs mt-2 opacity-70 ${isUser ? "text-blue-100" : "text-gray-500"}`}>
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
