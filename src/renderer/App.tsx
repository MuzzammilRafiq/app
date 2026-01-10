import ChatScreen from "./screens/chat";
import VisionScreen from "./screens/vision";
import SettingsScreen from "./screens/settings";
import Sidebar from "./components/sidebar";
import TitleBar from "./components/title-bar";
import { Toaster } from "react-hot-toast";
import { useCurrentViewStore, useSidebarCollapsedStore } from "./utils/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MenuSVG, GearSVG } from "./components/icons";

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
                    className="p-2 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-primary hover:bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-slate-200/50"
                    title="Open Sidebar"
                  >
                    {MenuSVG}
                  </button>
                  <button
                    onClick={() => setCurrentView("settings")}
                    className="p-2 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-primary hover:bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-slate-200/50"
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
