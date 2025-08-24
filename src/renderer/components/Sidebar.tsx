import { PlusSVG, TrashSVG, MenuSVG, GearSVG } from "./icons";
import {
  useChatSessionRecordsStore,
  useChatTitleStore,
  useCurrentSessionStore,
  useCurrentViewStore,
  useSidebarCollapsedStore,
} from "../utils/store";
import type { ChatSessionRecord, ChatSessionWithMessages } from "../../common/types";
import { useEffect } from "react";
import toast from "react-hot-toast";

const iconClass =
  "p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 flex items-center justify-center border border-gray-200 cursor-pointer hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-600 disabled:hover:bg-transparent disabled:hover:border-gray-200";

export default function Sidebar() {
  const { chatSessionRecords, setChatSessionRecords } = useChatSessionRecordsStore();
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebarCollapsedStore();
  const { currentSession, setCurrentSession } = useCurrentSessionStore();
  const setCurrentView = useCurrentViewStore((s) => s.setCurrentView);
  const setChatTitle = useChatTitleStore((s) => s.setChatTitle);

  const onNewSession = async () => {
    try {
      // Prefer a clean default title instead of reusing the prior one
      const title = "New Chat";
      const newSession = await window.electronAPI.dbCreateSession(title);
      setChatSessionRecords([...chatSessionRecords, newSession]);
      setCurrentSession({ ...newSession, messages: [] });
      setChatTitle(title);
    } catch (e) {
      console.error("Failed to create new session", e);
      toast.error("Failed to create new chat");
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      const sessions = await window.electronAPI.dbGetSessions();
      setChatSessionRecords(sessions);
      // const sessionsWithMessages: ChatSessionWithMessages[] = await Promise.all(
      //   sessions.map(async (session) => {
      //     const messages = await window.electronAPI.dbGetChatMessages(session.id);
      //     return { ...session, messages };
      //   })
      // );
      // TODO - memoise it later we dont need to load messages all at once every render
      // setChatSessionsWithMessages(sessionsWithMessages);
    };
    fetchMessages();
  }, []);

  const setCurrentChatSession = (session: ChatSessionRecord) => {
    // Defer message loading to ChatContainer effect for consistency & single responsibility
    const chatSessionWithMessages: ChatSessionWithMessages = { ...session, messages: [] };
    setCurrentSession(chatSessionWithMessages);
  };

  // const chatSessionRecords = useChatSessionRecordsStore(state=>state.chatSessionRecords);
  // const currentSession = useCurrentSessionStore(state => state.currentSession);

  if (sidebarCollapsed) {
    return (
      <div className="w-14 h-full flex flex-col">
        <div className="flex-1 overflow-y-auto p-2 w-full">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${iconClass} flex-1 overflow-y-auto p-2  mb-1 w-10`}
          >
            {MenuSVG}
          </button>
          <button onClick={onNewSession} className={`${iconClass} shadow-sm flex-1 p-2 mb-1 w-10`}>
            {PlusSVG}
          </button>
        </div>
        <div className="p-2">
          <button onClick={() => setCurrentView("settings")} className={`${iconClass} p-2 w-10`} title="Settings">
            {GearSVG}
          </button>
        </div>
      </div>
    );
  } else {
    return (
      <div className="w-52 h-full border-r border-gray-300 flex flex-col">
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

          {chatSessionRecords.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-8">No chat sessions yet</div>
          ) : (
            <div className="space-y-1">
              {chatSessionRecords.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                    currentSession?.id === session.id
                      ? "bg-blue-50 border-blue-200"
                      : "bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200"
                  }`}
                  onClick={() => setCurrentChatSession(session)}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        currentSession?.id === session.id ? "text-blue-700" : "text-gray-700"
                      }`}
                    >
                      {session.title}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // onDeleteSession(session.id);
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
