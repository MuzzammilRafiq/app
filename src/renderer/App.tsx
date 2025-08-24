import ChatContainer from "./components/ChatContainer";
import Sidebar from "./components/Sidebar";
import Settings from "./components/Settings";
import { Toaster } from "react-hot-toast";
import { useCurrentViewStore } from "./utils/store";

export default function App() {
  const currentView = useCurrentViewStore((state) => state.currentView);
  return (
    <div>
      <Toaster position="top-center" toastOptions={{ duration: 1000 }} />
      <div className="h-screen bg-white flex">
        <Sidebar />
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
        <div className="w-14 h-full"></div>
      </div>
    </div>
  );
}
