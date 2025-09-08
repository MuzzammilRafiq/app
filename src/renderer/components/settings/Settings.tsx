import { useCurrentViewStore } from "../../utils/store";
import Images from "./image";
import Text from "./text";
function Header() {
  const setCurrentView = useCurrentViewStore((state) => state.setCurrentView);
  return (
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-3xl font-bold text-gray-600">Settings</h1>
      <button
        onClick={() => setCurrentView("chat")}
        className=" cursor-pointer px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md transition-colors flex items-center"
      >
        <span className="mr-2">←</span>
        Back to Chat
      </button>
    </div>
  );
}
export default function Settings() {
  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full p-6">
      <Header />
      <Images />
      <div className="mt-6">
        <Text />
      </div>
    </div>
  );
}
