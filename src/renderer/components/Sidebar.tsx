import { PlusSVG, TrashSVG, MenuSVG, GearSVG } from "./icons";
import {
  useCurrentViewStore,
  useSidebarCollapsedStore,
  useStore,
} from "../utils/store";
import { useEffect } from "react";

// Updated button class for premium feel
const iconBtnClass =
  "p-2 text-slate-500 hover:text-primary hover:bg-primary-light/20 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer border border-transparent hover:border-primary-light/20 disabled:opacity-50 disabled:cursor-not-allowed";

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebarCollapsedStore();
  const setCurrentView = useCurrentViewStore((s) => s.setCurrentView);
  const populateSessions = useStore((s) => s.populateSessions);
  const currentSession = useStore((s) => s.currentSession);
  const chatSessionsWithMessages = useStore((s) => s.chatSessionsWithMessages);
  const setCurrentSession = useStore((s) => s.setCurrentSession);

  const onNewSession = async () => {
    setCurrentSession(undefined);
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

  useEffect(() => {
    (async () => {
      const sessions =
        await window.electronAPI.dbGetAllSessionsWithMessages(50);
      populateSessions(sessions);
    })();
  }, []);

  if (sidebarCollapsed) {
    return (
      <div className="w-16 h-full flex flex-col flex-shrink-0 select-none overflow-hidden border-r border-slate-200 bg-bg-app">
        <div className="flex-1 overflow-y-auto px-2 py-4 w-full flex flex-col items-center gap-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconBtnClass} w-10 h-10`}
            title="Expand Sidebar"
          >
            {MenuSVG}
          </button>
          <button
            onClick={onNewSession}
            className={`${iconBtnClass} w-10 h-10 shadow-sm bg-white border-slate-200 hover:border-primary-light/50 hover:shadow-md text-primary`}
            title="New Chat"
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
      <div className="w-64 h-full border-r border-slate-200 flex flex-col flex-shrink-0 select-none overflow-hidden transition-all duration-300 bg-bg-app">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1">
            Chat Settings
          </h1>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconBtnClass} w-8 h-8 !p-1`}
          >
            {MenuSVG}
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={onNewSession}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-2.5 px-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium text-sm"
          >
            {PlusSVG}
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {chatSessionsWithMessages.length === 0 ? (
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                    title="Delete Session"
                  >
                    <div className="w-4 h-4">{TrashSVG}</div>
                  </button>
                </div>
              ))}
            </div>
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
