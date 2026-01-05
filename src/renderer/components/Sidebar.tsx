import { PlusSVG, TrashSVG, MenuSVG, GearSVG, CrosshairSVG } from "./icons";
import {
  useCurrentViewStore,
  useSidebarCollapsedStore,
  useStore,
} from "../utils/store";
import { useEffect, memo, useState } from "react";
import type { VisionSessionWithLogs } from "../../common/types";
import { useVisionLogStore } from "./vision/VisionLogStore";

// Updated button class for premium feel
const iconBtnClass =
  "p-2 text-slate-500 hover:text-primary hover:bg-primary-light/20 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer border border-transparent hover:border-primary-light/20 disabled:opacity-50 disabled:cursor-not-allowed";

// Status badge colors
const statusColors: Record<string, string> = {
  running: "bg-blue-100 text-blue-600",
  completed: "bg-green-100 text-green-600",
  failed: "bg-red-100 text-red-600",
  cancelled: "bg-slate-100 text-slate-500",
};

function SidebarInner() {
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebarCollapsedStore();
  const currentView = useCurrentViewStore((s) => s.currentView);
  const setCurrentView = useCurrentViewStore((s) => s.setCurrentView);
  const populateSessions = useStore((s) => s.populateSessions);
  const currentSession = useStore((s) => s.currentSession);
  const chatSessionsWithMessages = useStore((s) => s.chatSessionsWithMessages);
  const setCurrentSession = useStore((s) => s.setCurrentSession);
  
  // Vision sessions state
  const [visionSessions, setVisionSessions] = useState<VisionSessionWithLogs[]>([]);
  const [currentVisionSession, setCurrentVisionSession] = useState<VisionSessionWithLogs | null>(null);
  const setLogs = useVisionLogStore((s) => s.setLogs);
  const clearLogs = useVisionLogStore((s) => s.clearLogs);

  const onNewSession = async () => {
    setCurrentSession(undefined);
  };

  const onNewVisionSession = () => {
    clearLogs();
    setCurrentVisionSession(null);
  };

  const onDeleteSession = async (id: string) => {
    try {
      await window.electronAPI.dbDeleteSession(id);
      const sessions =
        await window.electronAPI.dbGetAllSessionsWithMessages(50);
      populateSessions(sessions);
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const onDeleteVisionSession = async (id: string) => {
    try {
      await window.electronAPI.dbDeleteVisionSession(id);
      const sessions = await window.electronAPI.dbGetVisionSessionsWithLogs(50);
      setVisionSessions(sessions);
      if (currentVisionSession?.id === id) {
        setCurrentVisionSession(null);
        clearLogs();
      }
    } catch (err) {
      console.error("Failed to delete vision session", err);
    }
  };

  const onSelectVisionSession = (session: VisionSessionWithLogs) => {
    setCurrentVisionSession(session);
    // Load logs into the vision log store - use setLogs to preserve original IDs and timestamps
    const logEntries = session.logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      type: log.type,
      title: log.title,
      content: log.content,
      imagePath: log.imagePath,
    }));
    setLogs(logEntries);
  };

  // Load chat sessions
  useEffect(() => {
    (async () => {
      const sessions =
        await window.electronAPI.dbGetAllSessionsWithMessages(50);
      populateSessions(sessions);
    })();
  }, []);

  // Load vision sessions when switching to vision mode
  useEffect(() => {
    if (currentView === "vision") {
      (async () => {
        const sessions = await window.electronAPI.dbGetVisionSessionsWithLogs(50);
        setVisionSessions(sessions);
      })();
    }
  }, [currentView]);

  if (sidebarCollapsed) {
    return (
      <div className="w-16 h-full flex flex-col shrink-0 select-none overflow-hidden border-r border-slate-200 bg-bg-app">
        <div className="flex-1 overflow-y-auto px-2 py-4 w-full flex flex-col items-center gap-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconBtnClass} w-10 h-10`}
            title="Expand Sidebar"
          >
            {MenuSVG}
          </button>
          <button
            onClick={currentView === "vision" ? onNewVisionSession : onNewSession}
            className={`${iconBtnClass} w-10 h-10 shadow-sm bg-white border-slate-200 hover:border-primary-light/50 hover:shadow-md text-primary`}
            title={currentView === "vision" ? "New Vision Task" : "New Chat"}
          >
            {PlusSVG}
          </button>
        </div>
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => setCurrentView("settings")}
            className={`${iconBtnClass} w-full`}
            title="Settings"
          >
            {GearSVG}
          </button>
        </div>
      </div>
    );
  } else {
    return (
      <div className="w-64 h-full border-r border-slate-200 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300 bg-bg-app">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1">
            {currentView === "vision" ? "Vision Tasks" : "Chat Sessions"}
          </h1>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconBtnClass} w-8 h-8 p-1!`}
          >
            {MenuSVG}
          </button>
        </div>

        {/* Chat/Vision Toggle */}
        <div className="px-3 pb-3">
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setCurrentView("chat")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentView === "chat" || currentView === "settings"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </button>
            <button
              onClick={() => setCurrentView("vision")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentView === "vision"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {CrosshairSVG}
              Vision
            </button>
          </div>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={currentView === "vision" ? onNewVisionSession : onNewSession}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-2.5 px-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium text-sm"
          >
            {PlusSVG}
            <span>{currentView === "vision" ? "New Vision Task" : "New Chat"}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {currentView === "vision" ? (
            // Vision Sessions List
            visionSessions.length === 0 ? (
              <div className="text-center text-slate-400 text-sm mt-8 italic">
                No vision tasks yet
              </div>
            ) : (
              <div className="space-y-1">
                <h2 className="text-xs font-semibold text-slate-400 mb-2 px-1 mt-2">
                  Recent Tasks
                </h2>
                {visionSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      currentVisionSession?.id === session.id
                        ? "bg-primary-light/20 border-primary-light/40 text-primary shadow-sm"
                        : "bg-transparent border-transparent hover:bg-slate-100 hover:shadow-sm text-slate-600 hover:text-slate-900"
                    }`}
                    onClick={() => onSelectVisionSession(session)}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-sm truncate font-medium">
                        {session.goal.length > 30 ? session.goal.slice(0, 30) + "..." : session.goal}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[session.status] || statusColors.cancelled}`}>
                          {session.status}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {session.logs.length} logs
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeleteVisionSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer"
                      title="Delete Task"
                    >
                      <div className="w-4 h-4">{TrashSVG}</div>
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Chat Sessions List
            chatSessionsWithMessages.length === 0 ? (
              <div className="text-center text-slate-400 text-sm mt-8 italic">
                No chat sessions yet
              </div>
            ) : (
              <div className="space-y-1">
                <h2 className="text-xs font-semibold text-slate-400 mb-2 px-1 mt-2">
                  Recent
                </h2>
                {chatSessionsWithMessages.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      currentSession?.id === session.id
                        ? "bg-primary-light/20 border-primary-light/40 text-primary shadow-sm"
                        : "bg-transparent border-transparent hover:bg-slate-100 hover:shadow-sm text-slate-600 hover:text-slate-900"
                    }`}
                    onClick={() => setCurrentSession(session)}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-sm truncate font-medium">
                        {session.title || "New Conversation"}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer"
                      title="Delete Session"
                    >
                      <div className="w-4 h-4">{TrashSVG}</div>
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Settings button at bottom */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => setCurrentView("settings")}
            className="flex items-center gap-3 p-2.5 w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:shadow-sm rounded-xl transition-all duration-200"
            title="Settings"
          >
            <div className="text-slate-500">{GearSVG}</div>
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>
    );
  }
}

export default memo(SidebarInner);
