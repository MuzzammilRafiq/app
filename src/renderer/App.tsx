import { useState, useEffect, useRef } from "react";
import { streamMessageWithHistory, type ChatMessage, type ImageData } from "./services/geminiService";
import ChatContainer from "./components/ChatContainer";
import ChatInput, { type ChatInputHandle } from "./components/ChatInput";
import FloatingMenu from "./components/FloatingMenu";
import toast, { Toaster } from "react-hot-toast";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Ref to ChatInput to programmatically add images
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Listen for global screenshot trigger
  useEffect(() => {
    const handleGlobalScreenshot = async () => {
      try {
        const result = await window.electronAPI.captureScreenshot();

        if (result.success && result.hasImage && result.imageData) {
          // Add screenshot to chat input instead of chat
          chatInputRef.current?.addImage(result.imageData);
          toast.success("Screenshot added to input");
        } else if (result.success) {
          toast.success(result.message || "Screenshot completed");
        } else {
          // Only show error toast if it's not a cancellation
          if (result.error !== "Screenshot was cancelled") {
            toast.error(`Screenshot failed: ${result.error}`);
          }
        }
      } catch (error) {
        toast.error("Failed to take screenshot");
      }
    };

    // Set up the listener
    window.electronAPI.onGlobalScreenshotTrigger(handleGlobalScreenshot);

    // Cleanup function
    return () => {
      window.electronAPI.removeGlobalScreenshotListener();
    };
  }, []);

  const handleSendMessage = async (content: string, images?: ImageData[]) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
      images: images,
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

    let streamingCompleted = false;

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
          streamingCompleted = true;
          setIsStreaming(false);
        } else {
          // Update the message with the new chunk
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk.chunk } : msg))
          );
        }
      });

      // Only handle error if streaming didn't complete successfully
      if (response.error && !streamingCompleted) {
        let errorContent = "An error occurred";

        try {
          // Try to parse as JSON first
          const parsedError = JSON.parse(response.error);
          errorContent = parsedError.error?.message || parsedError.message || response.error;
        } catch {
          // If JSON parsing fails, treat as plain string
          errorContent = response.error;
        }

        // Update the assistant message with error, preserving any partial content
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === assistantMessageId) {
              const currentContent = msg.content;
              const errorSuffix = currentContent ? `\n\nError: ${errorContent}` : errorContent;
              return {
                ...msg,
                content: currentContent + errorSuffix,
                isError: true,
              };
            }
            return msg;
          })
        );
      }
    } catch (err) {
      // Only update with error if streaming didn't complete successfully
      if (!streamingCompleted) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === assistantMessageId) {
              const currentContent = msg.content;
              const errorSuffix = currentContent
                ? `\n\nError: Failed to send message. Please try again.`
                : "Failed to send message. Please try again.";
              return {
                ...msg,
                content: currentContent + errorSuffix,
                isError: true,
              };
            }
            return msg;
          })
        );
      }
    } finally {
      setIsLoading(false);
      // Only set streaming to false if it wasn't already set to false in the callback
      if (!streamingCompleted) {
        setIsStreaming(false);
      }
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleScreenshot = async () => {
    try {
      const result = await window.electronAPI.captureScreenshot();

      if (result.success && result.hasImage && result.imageData) {
        // Add screenshot to chat input instead of chat
        chatInputRef.current?.addImage(result.imageData);
        toast.success("Screenshot added to input");
      } else if (result.success) {
        toast.success(result.message || "Screenshot completed");
      } else {
        // Only show error toast if it's not a cancellation
        if (result.error !== "Screenshot was cancelled") {
          toast.error(`Screenshot failed: ${result.error}`);
        }
      }
    } catch (error) {
      toast.error("Failed to take screenshot");
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div>
      <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
      <div className="h-screen bg-white">
        {hasMessages ? (
          // Normal chat layout when messages exist
          <div className="h-full flex flex-col">
            <ChatContainer messages={messages} />
            <ChatInput
              ref={chatInputRef}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isStreaming={isStreaming}
              onScreenshot={handleScreenshot}
            />
          </div>
        ) : (
          // Centered layout when no messages
          <div className="h-full flex flex-col items-center justify-center px-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-normal text-gray-700 mb-8">Ready when you are.</h1>
            </div>
            <div className="w-full max-w-2xl">
              <ChatInput
                ref={chatInputRef}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onScreenshot={handleScreenshot}
              />
            </div>
          </div>
        )}

        <FloatingMenu onClearChat={handleClearChat} />
      </div>
    </div>
  );
}
