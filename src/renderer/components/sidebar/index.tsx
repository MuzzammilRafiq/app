import { PlusSVG, MenuSVG, GearSVG, CrosshairSVG } from "../icons";
import {
  useCurrentViewStore,
  useSidebarCollapsedStore,
  useStore,
} from "../../utils/store";
import { memo } from "react";
import { useVisionLogStore } from "../../utils/store";
import { ChatIcon } from "../icons";
import ChatSidebar from "../../screens/chat/_components/sidebar";
import VisionSidebar from "../../screens/vision/_components/sidebar";
const iconBtnClass =
  "p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer border border-transparent hover:border-primary/10 disabled:opacity-50 disabled:cursor-not-allowed";

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
        className="w-14 h-full flex flex-col shrink-0 select-none overflow-hidden border-r border-slate-100"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        <div className="flex-1 overflow-y-auto px-2 py-4 w-full flex flex-col items-center gap-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconBtnClass} w-10 h-10`}
            title="Expand Sidebar"
          >
            {MenuSVG}
          </button>
          <div className="w-6 h-px bg-slate-200 my-1" />
          <button
            onClick={
              currentView === "vision" ? onNewVisionSession : onNewSession
            }
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer"
            title={currentView === "vision" ? "New Vision Task" : "New Chat"}
          >
            {PlusSVG}
          </button>
        </div>
        <div className="p-2 border-t border-slate-100">
          <button
            onClick={() => setCurrentView("settings")}
            className={`${iconBtnClass} w-full h-10`}
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
        className="w-72 h-full border-r border-slate-100 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        {/* Header */}
        <div className="p-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary text-sm font-bold">O</span>
            </div>
            <span className="text-sm font-semibold text-slate-700">
              Open Desktop
            </span>
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconBtnClass} w-8 h-8`}
          >
            {MenuSVG}
          </button>
        </div>

        {/* Chat/Vision Toggle */}
        <div className="px-4 pb-3">
          <div className="flex bg-slate-100/80 rounded-xl p-1 gap-1">
            <button
              onClick={() => setCurrentView("chat")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentView === "chat" || currentView === "settings"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              <ChatIcon />
              <span>Chat</span>
              {chatCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    currentView === "chat" || currentView === "settings"
                      ? "bg-primary/10 text-primary"
                      : "bg-slate-200 text-slate-500"
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
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
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
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-medium text-sm group"
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
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => setCurrentView("settings")}
            className={`flex items-center gap-3 p-3 w-full rounded-xl transition-all duration-200 ${
              currentView === "settings"
                ? "bg-primary/5 text-primary"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
            title="Settings"
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                currentView === "settings" ? "bg-primary/10" : "bg-slate-100"
              }`}
            >
              {GearSVG}
            </div>
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>
    );
  }
}

export default memo(SidebarInner);
