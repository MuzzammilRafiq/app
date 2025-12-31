import ChatContainer from "./components/chat/chat-container";
import Sidebar from "./components/Sidebar";
import Settings from "./components/settings";
import { Toaster } from "react-hot-toast";
import { useCurrentViewStore } from "./utils/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <Toaster position="top-center" toastOptions={{ duration: 1000 }} />
        <div className="h-screen bg-white flex">
          {currentView === "chat" && <Sidebar />}
          <div className="flex-1 flex flex-col h-full">
            {(() => {
              switch (currentView) {
                case "settings":
                  return <Settings />;
                default:
                  return <ChatContainer />;
              }
            })()}
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}
export default App;
