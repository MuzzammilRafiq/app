import { useCurrentViewStore } from "../../utils/store";

interface SettingsSidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
}

export default function SettingsSidebar({
  currentSection,
  onSectionChange,
}: SettingsSidebarProps) {
  const setCurrentView = useCurrentViewStore((state) => state.setCurrentView);

  const buttonClass = (isActive: boolean) =>
    `group w-full px-3 py-2 flex items-center rounded-lg border transition-all duration-200 ${
      isActive
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
    }`;

  return (
    <div className="w-56 h-full bg-white border-r border-gray-200 flex flex-col">
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <button
          onClick={() => onSectionChange("general")}
          className={buttonClass(currentSection === "general")}
        >
          <span className="text-sm font-medium">General</span>
        </button>
        <button
          onClick={() => onSectionChange("images")}
          className={buttonClass(currentSection === "images")}
        >
          <span className="text-sm font-medium">Image</span>
        </button>
        <button
          onClick={() => onSectionChange("text")}
          className={buttonClass(currentSection === "text")}
        >
          <span className="text-sm font-medium">Text</span>
        </button>
        <button
          onClick={() => onSectionChange("advanced")}
          className={buttonClass(currentSection === "advanced")}
        >
          <span className="text-sm font-medium">Advanced</span>
        </button>
      </div>
      <div className="overflow-y-auto p-2">
        <button
          onClick={() => setCurrentView("chat")}
          className={buttonClass(false)}
        >
          <span className="text-sm font-medium p-2 border-t border-gray-200">
            <span className="mr-2">←</span>
            Back To Chat
          </span>
        </button>
      </div>
    </div>
  );
}
