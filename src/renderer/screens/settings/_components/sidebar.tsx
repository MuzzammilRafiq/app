import { useCurrentViewStore } from "../../../utils/store";
import { Settings, Image, FileText, Sliders, ArrowLeft } from "lucide-react";

interface SettingsSidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
}

// Helper component for menu items
function MenuItem({
  section,
  currentSection,
  onClick,
  icon: Icon,
  label,
}: {
  section: string;
  currentSection: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const isActive = currentSection === section;
  return (
    <div
      className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
        isActive
          ? "bg-linear-to-r from-primary/10 to-primary/5 border-primary/20 shadow-sm"
          : "bg-surface/50 border-border hover:bg-surface hover:border-border-strong hover:shadow-sm"
      }`}
      onClick={onClick}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
          isActive
            ? "bg-primary/10 text-primary"
            : "bg-primary-light/50 text-text-muted group-hover:bg-primary-light group-hover:text-text-main"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm truncate font-medium ${
            isActive
              ? "text-primary"
              : "text-text-main group-hover:text-primary"
          }`}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export default function SettingsSidebar({
  currentSection,
  onSectionChange,
}: SettingsSidebarProps) {
  const setCurrentView = useCurrentViewStore((state) => state.setCurrentView);

  return (
    <div className="w-72 h-full border-r border-border flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300 bg-bg-app">
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-text-muted uppercase tracking-wider pl-1">
          Settings
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-text-muted mb-2 px-1 mt-2">
            Sections
          </h2>
          <MenuItem
            section="general"
            currentSection={currentSection}
            onClick={() => onSectionChange("general")}
            icon={Settings}
            label="General"
          />
          <MenuItem
            section="images"
            currentSection={currentSection}
            onClick={() => onSectionChange("images")}
            icon={Image}
            label="Image"
          />
          <MenuItem
            section="text"
            currentSection={currentSection}
            onClick={() => onSectionChange("text")}
            icon={FileText}
            label="Text"
          />
          <MenuItem
            section="advanced"
            currentSection={currentSection}
            onClick={() => onSectionChange("advanced")}
            icon={Sliders}
            label="Advanced"
          />
        </div>
      </div>

      {/* Back to Chat button at bottom */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => setCurrentView("chat")}
          className="group flex items-center gap-3 p-2.5 w-full rounded-xl transition-all duration-200 bg-surface/50 border border-border hover:bg-surface hover:border-border-strong hover:shadow-sm"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary-light/50 text-text-muted group-hover:bg-primary-light group-hover:text-text-main transition-all duration-200">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-text-main group-hover:text-primary">
            Back To Chat
          </span>
        </button>
      </div>
    </div>
  );
}
