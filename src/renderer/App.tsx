import { useState } from "react";
import { sendMessageWithHistory, type ChatMessage } from "./services/geminiService";
import ChatContainer from "./components/ChatContainer";
import ChatInput from "./components/ChatInput";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendMessageWithHistory([...messages, userMessage]);

      if (response.error) {
        setError(response.error);
      } else {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: response.text,
          role: "assistant",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      setError("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🤖</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Chat</h1>
              <p className="text-sm text-gray-500">Powered by Google Gemini</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearChat}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            >
              Clear Chat
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <ChatContainer messages={messages} />

      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
