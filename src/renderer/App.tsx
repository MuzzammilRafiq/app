import ChatScreen from "./screens/chat";
import VisionScreen from "./screens/vision";
import SettingsScreen from "./screens/settings";
import Sidebar from "./components/sidebar";
import TitleBar from "./components/title-bar";
import { Toaster } from "react-hot-toast";
import { useCurrentViewStore, useSidebarCollapsedStore } from "./utils/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MenuSVG, GearSVG, PlusSVG } from "./components/icons";
import { useStore, useVisionLogStore } from "./utils/store";
import { useThemeInit } from "./hooks/useTheme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function App() {
  const currentView = useCurrentViewStore((s) => s.currentView);
  const setCurrentView = useCurrentViewStore((s) => s.setCurrentView);
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebarCollapsedStore();

  // Initialize theme on mount
  useThemeInit();

  // Store actions for new session
  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const clearLogs = useVisionLogStore((s) => s.clearLogs);
  const setVisionSessionId = useVisionLogStore((s) => s.setCurrentSessionId);

  const onNewSession = () => {
    if (currentView === "vision") {
      clearLogs();
      setVisionSessionId(null);
      // Determine if we need to notify any other components (like in SidebarInner)
      // The SidebarInner does this via window hack, but here we can just clear state directly
      if ((window as any).__visionSidebarNewSession) {
        (window as any).__visionSidebarNewSession();
      }
    } else {
      setCurrentSession(undefined);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className="h-screen overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        <TitleBar />
        <Toaster position="top-center" toastOptions={{ duration: 1000 }} />
        <div
          className="flex-1 flex overflow-hidden"
          style={{ backgroundColor: "transparent" }}
        >
          {/* Sidebar for Chat and Vision views */}
          {(currentView === "chat" || currentView === "vision") &&
            !sidebarCollapsed && <Sidebar />}

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
            {/* Floating icons when sidebar is collapsed (for Chat and Vision views) */}
            {(currentView === "chat" || currentView === "vision") &&
              sidebarCollapsed && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="p-1 text-text-muted hover:text-primary hover:bg-primary-light/30 rounded-lg transition-all duration-200 flex items-center justify-center border border-border cursor-pointer hover:border-primary/20 w-10 h-10"
                    title="Open Sidebar"
                  >
                    {MenuSVG}
                  </button>
                  <button
                    onClick={onNewSession}
                    className="p-1 text-text-muted hover:text-primary hover:bg-primary-light/30 rounded-lg transition-all duration-200 flex items-center justify-center border border-border cursor-pointer hover:border-primary/20 w-10 h-10"
                    title={
                      currentView === "vision" ? "New Vision Task" : "New Chat"
                    }
                  >
                    {PlusSVG}
                  </button>
                  <button
                    onClick={() => setCurrentView("settings")}
                    className="p-1 text-text-muted hover:text-primary hover:bg-primary-light/30 rounded-lg transition-all duration-200 flex items-center justify-center border border-border cursor-pointer hover:border-primary/20 w-10 h-10"
                    title="Settings"
                  >
                    {GearSVG}
                  </button>
                </div>
              )}

            {(() => {
              switch (currentView) {
                case "settings":
                  return <SettingsScreen />;
                case "vision":
                  return <VisionScreen />;
                default:
                  return <ChatScreen />;
              }
            })()}
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}
export default App;
