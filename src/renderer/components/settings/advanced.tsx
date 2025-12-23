import { useState } from "react";
import toast from "react-hot-toast";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "../../services/settingsStorage";
import { LLMConfigSection } from "./LLMConfigSection";

export default function AdvancedSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [saving, setSaving] = useState(false);

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
      <LLMConfigSection settings={settings} onSettingsChange={setSettings} />
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
}
