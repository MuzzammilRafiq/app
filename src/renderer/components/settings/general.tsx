import { useState } from "react";
import toast from "react-hot-toast";
import Input from "../../ui/input";
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
        <div className="text-sm font-medium text-slate-800">Profile</div>
        <div className="rounded-lg border border-gray-200 p-3 bg-white">
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Display name
          </label>
          <Input
            type="text"
            placeholder="Enter your name"
            value={settings.displayName}
            onChange={(e) =>
              setSettings((s) => ({ ...s, displayName: e.target.value }))
            }
            className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 border border-gray-300"
          />
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Preferred language
            </label>
            <select
              value={settings.preferredLanguage}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  preferredLanguage: e.target.value,
                }))
              }
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 border border-gray-300"
            >
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
              <option value="german">German</option>
              <option value="custom">Custom</option>
            </select>
            {settings.preferredLanguage === "custom" && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Additional info
                </label>
                <textarea
                  placeholder="Enter additional info"
                  value={settings.preferredLanguageCustomInfo}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      preferredLanguageCustomInfo: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 border border-gray-300 min-h-[96px]"
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-800">Preferences</div>
        <div className="space-y-2">
          {row("Dark mode", "Use a dark theme", settings.theme === "dark", () =>
            onToggle("theme")
          )}
          {row(
            "Notifications",
            "Show desktop notifications",
            settings.notificationsEnabled,
            () => onToggle("notificationsEnabled")
          )}
          {row(
            "Sound effects",
            "Play send and receive sounds",
            settings.soundEnabled,
            () => onToggle("soundEnabled")
          )}
          {row(
            "Compact mode",
            "Condense spacing in chat",
            settings.compactMode,
            () => onToggle("compactMode")
          )}
          {row(
            "Confirm clear chat",
            "Ask before clearing conversations",
            settings.confirmClearChat,
            () => onToggle("confirmClearChat")
          )}
          {row(
            "Launch at login",
            "Start app on system login",
            settings.autoLaunch,
            () => onToggle("autoLaunch")
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
            saving ? "opacity-50 cursor-not-allowed" : ""
          } bg-blue-600 text-white hover:bg-blue-700`}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
  function row(
    title: string,
    description: string,
    enabled: boolean,
    onClick: () => void
  ) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800">{title}</div>
          <div className="text-xs text-slate-600">{description}</div>
        </div>
        <button
          onClick={onClick}
          role="switch"
          aria-checked={enabled}
          className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            enabled ? "bg-blue-600" : "bg-gray-200"
          } shadow-inner`}
        >
          <span
            className={`absolute left-0.5 top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
              enabled
                ? "translate-x-4 border border-blue-600"
                : "translate-x-0 border border-gray-300"
            }`}
          />
        </button>
      </div>
    );
  }
}
