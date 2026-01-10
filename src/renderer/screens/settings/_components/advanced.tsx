import { useState } from "react";
import toast from "react-hot-toast";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "../../../utils/localstore";
import { EyeIcon, EyeOffIcon } from "../../../components/icons";

export default function AdvancedSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
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
        <div className="text-sm font-medium text-slate-800">
          LLM Configuration
        </div>
        <div className="rounded-lg border border-gray-200 p-3 bg-surface space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                OpenRouter API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="sk-or-v1-..."
                  value={settings.openrouterApiKey || ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      openrouterApiKey: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 pr-10 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 border border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200 border border-gray-200 hover:border-blue-200"
                >
                  {showKey ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Text Model (ID)
              </label>
              <input
                type="text"
                placeholder="moonshotai/kimi-k2-0905"
                value={settings.textModel || ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    textModel: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 border border-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Image Model (ID)
              </label>
              <input
                type="text"
                placeholder="qwen/qwen3-vl-30b-a3b-thinking"
                value={settings.imageModel || ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    imageModel: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 border border-gray-300"
              />
            </div>
          </div>
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
