import { useState } from "react";
import { sendMessageWithHistory, type ChatMessage } from "./services/geminiService";
import ChatContainer from "./components/ChatContainer";
import ChatInput from "./components/ChatInput";
import FloatingMenu from "./components/FloatingMenu";
import toast, { Toaster } from "react-hot-toast";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sendMessageWithHistory([...messages, userMessage]);

      if (response.error) {
        let errorContent = "An error occurred";

        try {
          // Try to parse as JSON first
          const parsedError = JSON.parse(response.error);
          errorContent = parsedError.error?.message || parsedError.message || response.error;
        } catch {
          // If JSON parsing fails, treat as plain string
          errorContent = response.error;
        }

        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: errorContent,
          role: "assistant",
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
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
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "Failed to send message. Please try again.",
        role: "assistant",
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleScreenshot = async () => {
    try {
      const result = await window.electronAPI.captureScreenshot();

      if (result.success) {
        toast.success(result.message || "Screenshot completed");
      } else {
        toast.error(`Screenshot failed: ${result.error}`);
      }
    } catch (error) {
      toast.error("Failed to take screenshot");
    }
  };

  return (
    <div>
      <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
      <div className="h-screen flex flex-col bg-gray-50">
        <ChatContainer messages={messages} />

        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} onScreenshot={handleScreenshot} />

        <FloatingMenu onClearChat={handleClearChat} />
      </div>
    </div>
  );
}
