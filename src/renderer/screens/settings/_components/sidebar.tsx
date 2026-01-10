import { useCurrentViewStore } from "../../../utils/store";
import {
  Settings,
  Image,
  FileText,
  Sliders,
  ArrowLeft,
} from "lucide-react";

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
    <div className="w-72 h-full border-r border-slate-100 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300 bg-bg-app">
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
            className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              currentSection === "general"
                ? "bg-linear-to-r from-primary/10 to-primary/5 border-primary/20 shadow-sm"
                : "bg-white/50 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm"
            }`}
            onClick={() => onSectionChange("general")}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                currentSection === "general"
                  ? "bg-primary/10 text-primary"
                  : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500"
              }`}
            >
              <Settings className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm truncate font-medium ${
                  currentSection === "general"
                    ? "text-primary"
                    : "text-slate-600 group-hover:text-slate-900"
                }`}
              >
                General
              </div>
            </div>
          </div>
          <div
            className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              currentSection === "images"
                ? "bg-linear-to-r from-primary/10 to-primary/5 border-primary/20 shadow-sm"
                : "bg-white/50 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm"
            }`}
            onClick={() => onSectionChange("images")}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                currentSection === "images"
                  ? "bg-primary/10 text-primary"
                  : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500"
              }`}
            >
              <Image className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm truncate font-medium ${
                  currentSection === "images"
                    ? "text-primary"
                    : "text-slate-600 group-hover:text-slate-900"
                }`}
              >
                Image
              </div>
            </div>
          </div>
          <div
            className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              currentSection === "text"
                ? "bg-linear-to-r from-primary/10 to-primary/5 border-primary/20 shadow-sm"
                : "bg-white/50 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm"
            }`}
            onClick={() => onSectionChange("text")}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                currentSection === "text"
                  ? "bg-primary/10 text-primary"
                  : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500"
              }`}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm truncate font-medium ${
                  currentSection === "text"
                    ? "text-primary"
                    : "text-slate-600 group-hover:text-slate-900"
                }`}
              >
                Text
              </div>
            </div>
          </div>
          <div
            className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
              currentSection === "advanced"
                ? "bg-linear-to-r from-primary/10 to-primary/5 border-primary/20 shadow-sm"
                : "bg-white/50 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm"
            }`}
            onClick={() => onSectionChange("advanced")}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                currentSection === "advanced"
                  ? "bg-primary/10 text-primary"
                  : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500"
              }`}
            >
              <Sliders className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm truncate font-medium ${
                  currentSection === "advanced"
                    ? "text-primary"
                    : "text-slate-600 group-hover:text-slate-900"
                }`}
              >
                Advanced
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back to Chat button at bottom */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={() => setCurrentView("chat")}
          className="flex items-center gap-3 p-2.5 w-full rounded-xl transition-all duration-200 bg-white/50 border border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500 transition-all duration-200">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back To Chat
          </span>
        </button>
      </div>
    </div>
  );
}
