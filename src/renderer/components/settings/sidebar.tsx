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

  return (
    <div className="w-64 h-full border-r border-slate-200 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300 bg-bg-app">
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1">
          Settings
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 mb-2 px-1 mt-2">
            Sections
          </h2>
          <div
            className={`group flex items-center p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              currentSection === "general"
                ? "bg-primary-light/20 border-primary-light/40 text-primary shadow-sm"
                : "bg-transparent border-transparent hover:bg-slate-100 hover:shadow-sm text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => onSectionChange("general")}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">General</div>
            </div>
          </div>
          <div
            className={`group flex items-center p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              currentSection === "images"
                ? "bg-primary-light/20 border-primary-light/40 text-primary shadow-sm"
                : "bg-transparent border-transparent hover:bg-slate-100 hover:shadow-sm text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => onSectionChange("images")}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">Image</div>
            </div>
          </div>
          <div
            className={`group flex items-center p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              currentSection === "text"
                ? "bg-primary-light/20 border-primary-light/40 text-primary shadow-sm"
                : "bg-transparent border-transparent hover:bg-slate-100 hover:shadow-sm text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => onSectionChange("text")}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">Text</div>
            </div>
          </div>
          <div
            className={`group flex items-center p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              currentSection === "advanced"
                ? "bg-primary-light/20 border-primary-light/40 text-primary shadow-sm"
                : "bg-transparent border-transparent hover:bg-slate-100 hover:shadow-sm text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => onSectionChange("advanced")}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">Advanced</div>
            </div>
          </div>
        </div>
      </div>

      {/* Back to Chat button at bottom */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={() => setCurrentView("chat")}
          className="flex items-center gap-3 p-2.5 w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:shadow-sm rounded-xl transition-all duration-200"
        >
          <span className="text-sm font-medium">
            <span className="mr-2">←</span>
            Back To Chat
          </span>
        </button>
      </div>
    </div>
  );
}
