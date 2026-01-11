import { PlusSVG, MenuSVG, GearSVG, CrosshairSVG, SDIcon } from "../icons";
import {
  useCurrentViewStore,
  useSidebarCollapsedStore,
  useStore,
} from "../../utils/store";
import { memo } from "react";
import { useVisionLogStore } from "../../utils/store";
import { ChatIcon, iconClass } from "../icons";
import ChatSidebar from "../../screens/chat/_components/sidebar";
import VisionSidebar from "../../screens/vision/_components/sidebar";

function SidebarInner() {
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebarCollapsedStore();
  const currentView = useCurrentViewStore((s) => s.currentView);
  const setCurrentView = useCurrentViewStore((s) => s.setCurrentView);
  const chatSessionsWithMessages = useStore((s) => s.chatSessionsWithMessages);
  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const clearLogs = useVisionLogStore((s) => s.clearLogs);

  const onNewSession = async () => {
    setCurrentSession(undefined);
  };

  const onNewVisionSession = () => {
    clearLogs();
    // Also trigger the vision sidebar's new session handler if available
    if ((window as any).__visionSidebarNewSession) {
      (window as any).__visionSidebarNewSession();
    }
  };

  // Session counts for display
  const chatCount = chatSessionsWithMessages.length;

  if (sidebarCollapsed) {
    return (
      <div
        className="w-14 h-full flex flex-col shrink-0 select-none overflow-hidden border-r border-border transition-colors"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        <div className="flex-1 overflow-y-auto px-2 py-4 w-full flex flex-col items-center gap-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconClass} w-10 h-10`}
            title="Expand Sidebar"
          >
            {MenuSVG}
          </button>
          <div className="w-6 h-px bg-border my-1" />
          <button
            onClick={
              currentView === "vision" ? onNewVisionSession : onNewSession
            }
            className="w-10 h-10 flex items-center justify-center rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: "var(--btn-accent-bg)",
              color: "var(--btn-accent-text)",
            }}
            title={currentView === "vision" ? "New Vision Task" : "New Chat"}
          >
            {PlusSVG}
          </button>
        </div>
        <div className="p-2 border-t border-border">
          <button
            onClick={() => setCurrentView("settings")}
            className={`${iconClass} w-full h-10`}
            title="Settings"
          >
            {GearSVG}
          </button>
        </div>
      </div>
    );
  } else {
    return (
      <div
        className="w-72 h-full border-r border-border flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        {/* Header */}
        <div className="p-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`${iconClass} w-8 h-8`}>
              <SDIcon />
            </div>
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconClass} w-8 h-8`}
          >
            {MenuSVG}
          </button>
        </div>

        {/* Chat/Vision Toggle */}
        <div className="px-4 pb-3">
          <div className="flex bg-primary-light/50 rounded-xl p-1 gap-1">
            <button
              onClick={() => setCurrentView("chat")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentView === "chat" || currentView === "settings"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-text-muted hover:text-text-main hover:bg-surface/50"
              }`}
            >
              <ChatIcon />
              <span>Chat</span>
              {chatCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    currentView === "chat" || currentView === "settings"
                      ? "bg-primary/10 text-primary"
                      : "bg-border text-text-muted"
                  }`}
                >
                  {chatCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentView("vision")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentView === "vision"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-text-muted hover:text-text-main hover:bg-surface/50"
              }`}
            >
              {CrosshairSVG}
              <span>Vision</span>
            </button>
          </div>
        </div>

        {/* New Button */}
        <div className="px-4 pb-3">
          <button
            onClick={
              currentView === "vision" ? onNewVisionSession : onNewSession
            }
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-medium text-sm group"
            style={{
              backgroundColor: "var(--btn-accent-bg)",
              color: "var(--btn-accent-text)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--btn-accent-bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--btn-accent-bg)")
            }
          >
            <span className="group-hover:scale-110 transition-transform duration-200">
              {PlusSVG}
            </span>
            <span>
              {currentView === "vision"
                ? "New Vision Task"
                : "New Conversation"}
            </span>
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {currentView === "vision" ? <VisionSidebar /> : <ChatSidebar />}
        </div>

        {/* Settings button at bottom */}
        <div className="p-4 border-t border-border">
          <button
            onClick={() => setCurrentView("settings")}
            className={`${iconClass} w-8 h-8`}
            title="Settings"
          >
            {GearSVG}
          </button>
        </div>
      </div>
    );
  }
}

export default memo(SidebarInner);
