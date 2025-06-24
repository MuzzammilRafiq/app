import { useState } from "react";
import { sendMessageWithHistory, type ChatMessage } from "./services/geminiService";
import ChatContainer from "./components/ChatContainer";
import ChatInput from "./components/ChatInput";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [screenshotStatus, setScreenshotStatus] = useState<string | null>(null);

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

  const handleScreenshot = async () => {
    try {
      setScreenshotStatus("Taking screenshot...");
      const result = await window.electronAPI.captureScreenshot();

      if (result.success) {
        if (result.platform === "windows") {
          setScreenshotStatus("Snipping Tool opened. Please capture your screenshot manually.");
          setTimeout(() => setScreenshotStatus(null), 5000);
        } else if (result.filePath) {
          setScreenshotStatus(`Screenshot saved: ${result.filePath}`);
          setTimeout(() => setScreenshotStatus(null), 3000);
        } else {
          setScreenshotStatus(result.message || "Screenshot completed");
          setTimeout(() => setScreenshotStatus(null), 3000);
        }
      } else {
        setScreenshotStatus(`Screenshot failed: ${result.error}`);
        setTimeout(() => setScreenshotStatus(null), 5000);
      }
    } catch (error) {
      setScreenshotStatus("Failed to take screenshot");
      setTimeout(() => setScreenshotStatus(null), 5000);
    }
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
              onClick={handleScreenshot}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Screenshot</span>
            </button>
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

      {screenshotStatus && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">{screenshotStatus}</p>
            </div>
          </div>
        </div>
      )}

      <ChatContainer messages={messages} />

      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
