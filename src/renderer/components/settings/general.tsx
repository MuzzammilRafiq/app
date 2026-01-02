import { useState } from "react";
import toast from "react-hot-toast";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "../../services/settingsStorage";
export default function GeneralSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [saving, setSaving] = useState(false);
  const onToggle = (key: keyof AppSettings) => {
    if (key === "theme") {
      setSettings((s) => ({
        ...s,
        theme: s.theme === "dark" ? "light" : "dark",
      }));
    } else {
      const current = settings[key] as unknown as boolean;
      setSettings((s) => ({ ...s, [key]: !current }));
    }
  };
  const onSave = () => {
    setSaving(true);
    try {
      saveSettings(settings);
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-800">Preferences</div>
        <div className="space-y-2">
          <Row
            title="Dark mode"
            description="Use a dark theme"
            enabled={settings.theme === "dark"}
            onClick={() => onToggle("theme")}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
            saving ? "opacity-50 cursor-not-allowed" : ""
          } bg-primary text-white hover:bg-primary-hover`}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function Row({
  title,
  description,
  enabled,
  onClick,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-surface p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-600">{description}</div>
      </div>
      <button
        onClick={onClick}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
          enabled ? "bg-primary" : "bg-gray-200"
        } shadow-inner`}
      >
        <span
          className={`absolute left-0.5 top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
            enabled
              ? "translate-x-4 border border-primary"
              : "translate-x-0 border border-gray-300"
          }`}
        />
      </button>
    </div>
  );
}
