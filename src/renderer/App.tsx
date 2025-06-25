import { useState } from "react";
import { sendMessageWithHistory, streamMessageWithHistory, type ChatMessage } from "./services/geminiService";
import ChatContainer from "./components/ChatContainer";
import ChatInput from "./components/ChatInput";
import FloatingMenu from "./components/FloatingMenu";
import toast, { Toaster } from "react-hot-toast";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Create a placeholder assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsStreaming(true);

    try {
      // Use streaming API
      const response = await streamMessageWithHistory([...messages, userMessage], (chunk) => {
        if (chunk.isComplete) {
          // Update the final message with complete text
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: chunk.fullText || msg.content } : msg
            )
          );
          setIsStreaming(false);
        } else {
          // Update the message with the new chunk
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk.chunk } : msg))
          );
        }
      });

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

        // Update the assistant message with error
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: errorContent, isError: true } : msg))
        );
      }
    } catch (err) {
      // Update the assistant message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: "Failed to send message. Please try again.", isError: true }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
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

        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onScreenshot={handleScreenshot}
        />

        <FloatingMenu onClearChat={handleClearChat} />
      </div>
    </div>
  );
}
