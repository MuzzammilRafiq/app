import { PlusSVG, TrashSVG, MenuSVG, GearSVG } from "./icons";
import {
  useCurrentViewStore,
  useSidebarCollapsedStore,
  useStore,
} from "../utils/store";
import { useEffect } from "react";

const iconClass =
  "p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 flex items-center justify-center border border-gray-200 cursor-pointer hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-600 disabled:hover:bg-transparent disabled:hover:border-gray-200";

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
      <div className="w-14 h-full flex flex-col flex-shrink-0 select-none overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2 w-full">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconClass} flex-1 overflow-y-auto p-2  mb-1 w-10`}
          >
            {MenuSVG}
          </button>
          <button
            onClick={onNewSession}
            className={`${iconClass} shadow-sm flex-1 p-2 mb-1 w-10`}
          >
            {PlusSVG}
          </button>
        </div>
        <div className="p-2">
          <button
            onClick={() => setCurrentView("settings")}
            className={`${iconClass} p-2 w-10`}
            title="Settings"
          >
            {GearSVG}
          </button>
        </div>
      </div>
    );
  } else {
    return (
      <div className="w-52 h-full border-r border-gray-300 flex flex-col flex-shrink-0 select-none overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconClass} flex-1 overflow-y-auto p-2 w-full  justify-start mb-1`}
          >
            {MenuSVG}
            <span className="ml-2 text-sm font-medium">Toggle Sidebar</span>
          </button>
          <button
            onClick={onNewSession}
            className={`${iconClass} shadow-sm bg-white flex-1 p-2 w-full justify-start mb-1`}
          >
            {PlusSVG}
            <span className="ml-2 text-sm font-medium">New Chat</span>
          </button>

          {chatSessionsWithMessages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-8">
              No chat sessions yet
            </div>
          ) : (
            <div className="space-y-1">
              {chatSessionsWithMessages.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                    currentSession?.id === session.id
                      ? "bg-blue-50 border-blue-200"
                      : "bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200"
                  }`}
                  onClick={() => setCurrentSession(session)}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        currentSession?.id === session.id
                          ? "text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      {session.title}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDeleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all duration-200"
                    title="Delete Session"
                  >
                    {TrashSVG}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings button at bottom */}
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => setCurrentView("settings")}
            className={`${iconClass} p-2 w-full justify-start`}
            title="Settings"
          >
            {GearSVG}
            <span className="ml-2 text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>
    );
  }
}
