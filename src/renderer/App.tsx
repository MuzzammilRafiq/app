import { useState, useRef } from "react";
import { type ImageData } from "./services/imageUtils";
import ChatContainer from "./components/ChatContainer";
import ChatInput, { type ChatInputHandle } from "./components/ChatInput";
import Sidebar from "./components/Sidebar";
import Settings from "./components/Settings";
import { Toaster } from "react-hot-toast";
import { useSessionManager, useScreenshot } from "./hooks";
import { handleSendMessage } from "./utils/messageHandler";

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<"chat" | "settings">("chat");

  // Ref to ChatInput to programmatically add images
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Use custom hooks
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    messages,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
  } = useSessionManager();
  console.log(JSON.stringify(messages, null, 2));

  // Use custom hooks for screenshot and execution updates
  const { handleScreenshot } = useScreenshot(chatInputRef);
  // useExecutionUpdates({ currentSessionId, setSessions });

  const handleSendMessageWrapper = async (content: string, images?: ImageData[]) => {
    await handleSendMessage({
      content,
      images,
      currentSessionId,
      messages,
      setSessions,
      setCurrentSessionId,
      setIsLoading,
      setIsStreaming,
    });
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleOpenSettings = () => {
    setCurrentView("settings");
  };

  const handleCloseSettings = () => {
    setCurrentView("chat");
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
          onOpenSettings={handleOpenSettings}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full">
          {currentView === "chat" ? (
            <>
              {/* Chat Area */}
              {messages.length > 0 ? (
                <div className="flex-1 flex flex-col h-full">
                  <div className="flex-1 overflow-hidden">
                    <ChatContainer messages={messages} />
                  </div>
                  <div className="flex-shrink-0 px-4 pb-4">
                    <ChatInput
                      ref={chatInputRef}
                      onSendMessage={handleSendMessageWrapper}
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
                    onSendMessage={handleSendMessageWrapper}
                    isLoading={isLoading}
                    isStreaming={isStreaming}
                    onScreenshot={handleScreenshot}
                  />
                </div>
              )}
            </>
          ) : (
            /* Settings Page */
            <Settings onClose={handleCloseSettings} />
          )}
        </div>

        <div className="w-14 h-full"></div>
      </div>
    </div>
  );
}
