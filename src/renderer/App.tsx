import { useState, useEffect, useRef } from "react";
import { streamMessageWithHistory, type ChatMessage, type ImageData } from "./services/geminiService";
import {
  loadChatSessions,
  saveChatSessions,
  createNewSession,
  deleteSession,
  type ChatSession,
} from "./services/chatStorage";
import ChatContainer from "./components/ChatContainer";
import ChatInput, { type ChatInputHandle } from "./components/ChatInput";
import Sidebar from "./components/Sidebar";
import toast, { Toaster } from "react-hot-toast";

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Ref to ChatInput to programmatically add images
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Get current session
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const messages = currentSession?.messages || [];

  // Load sessions on component mount
  useEffect(() => {
    const loadedSessions = loadChatSessions();
    setSessions(loadedSessions);

    // If no current session and we have sessions, select the first one
    if (!currentSessionId && loadedSessions.length > 0) {
      setCurrentSessionId(loadedSessions[0]?.id || null);
    }
  }, []);

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveChatSessions(sessions);
    }
  }, [sessions]);

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
        console.log(error);
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
    let sessionId = currentSessionId;

    // Create new session if none exists
    if (!sessionId) {
      const newSession = createNewSession();
      sessionId = newSession.id;
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
      images: images,
    };

    // Add user message and update session title
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === sessionId) {
          const updatedSession = { ...session, messages: [...session.messages, userMessage] };
          const firstUserMessage = updatedSession.messages.find((msg) => msg.role === "user" && msg.content.trim());
          if (firstUserMessage) {
            const title =
              firstUserMessage.content.length > 50
                ? firstUserMessage.content.substring(0, 47) + "..."
                : firstUserMessage.content;
            return { ...updatedSession, title: title || "New Chat", updatedAt: new Date() };
          }
          return { ...updatedSession, updatedAt: new Date() };
        }
        return session;
      })
    );

    setIsLoading(true);

    // Create a placeholder assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    // Add assistant message using direct state update
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === sessionId) {
          return {
            ...session,
            messages: [...session.messages, assistantMessage],
            updatedAt: new Date(),
          };
        }
        return session;
      })
    );

    let streamingCompleted = false;
    let streamingStarted = false;

    try {
      // Use streaming API
      const response = await streamMessageWithHistory([...messages, userMessage], (chunk) => {
        // Set streaming to true on first chunk received
        if (!streamingStarted) {
          streamingStarted = true;
          setIsLoading(false);
          setIsStreaming(true);
        }

        if (chunk.isComplete) {
          // Update the final message with complete text
          setSessions((prev) =>
            prev.map((session) => {
              if (session.id === sessionId) {
                return {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, content: chunk.fullText || msg.content } : msg
                  ),
                  updatedAt: new Date(),
                };
              }
              return session;
            })
          );
          streamingCompleted = true;
          setIsStreaming(false);
        } else {
          // Update the message with the new chunk
          setSessions((prev) =>
            prev.map((session) => {
              if (session.id === sessionId) {
                return {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk.chunk } : msg
                  ),
                  updatedAt: new Date(),
                };
              }
              return session;
            })
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
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === sessionId) {
              return {
                ...session,
                messages: session.messages.map((msg) => {
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
                }),
                updatedAt: new Date(),
              };
            }
            return session;
          })
        );
      }
    } catch (err) {
      console.log(err);
      // Only update with error if streaming didn't complete successfully
      if (!streamingCompleted) {
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === sessionId) {
              return {
                ...session,
                messages: session.messages.map((msg) => {
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
                }),
                updatedAt: new Date(),
              };
            }
            return session;
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

  const handleNewSession = () => {
    const newSession = createNewSession();
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => deleteSession(prev, sessionId));

    // If we're deleting the current session, select the first available one
    if (currentSessionId === sessionId) {
      const remainingSessions = deleteSession(sessions, sessionId);
      setCurrentSessionId(remainingSessions.length > 0 ? remainingSessions[0]?.id || null : null);
    }
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
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
      console.log(error);
      toast.error("Failed to take screenshot");
    }
  };

  return (
    <div>
      <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
      <div className="h-screen bg-white flex">
        {/* Sidebar */}
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full">
          {/* Chat Area */}
          {messages.length > 0 ? (
            <div className="flex-1 flex flex-col h-full">
              <div className="flex-1 overflow-hidden">
                <ChatContainer messages={messages} />
              </div>
              <div className="flex-shrink-0 px-4 pb-4">
                <ChatInput
                  ref={chatInputRef}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  isStreaming={isStreaming}
                  onScreenshot={handleScreenshot}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl mb-4 text-blue-700">👋 How can I help you ?</h1>
              </div>
              <ChatInput
                ref={chatInputRef}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onScreenshot={handleScreenshot}
              />
            </div>
          )}
        </div>

        <div className="w-14 h-full"></div>
      </div>
    </div>
  );
}
