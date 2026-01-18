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
        <div className="text-sm font-medium text-text-main">
          LLM Configuration
        </div>
        <div className="rounded-lg border border-border p-3 bg-surface space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-main mb-2">
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
                  className="w-full px-4 py-3 pr-10 rounded-lg bg-surface text-text-main placeholder-text-subtle focus:ring-2 focus:ring-primary border border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-main hover:text-primary hover:bg-primary-light rounded-md transition-all duration-200 border border-border hover:border-primary"
                >
                  {showKey ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-main mb-2">
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
                className="w-full px-4 py-3 rounded-lg bg-surface text-text-main placeholder-text-subtle focus:ring-2 focus:ring-primary border border-border"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-main mb-2">
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
                className="w-full px-4 py-3 rounded-lg bg-surface text-text-main placeholder-text-subtle focus:ring-2 focus:ring-primary border border-border"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent ${
            saving ? "opacity-50 cursor-not-allowed" : ""
          }`}
          style={{
            backgroundColor: "var(--btn-accent-bg)",
            color: "var(--btn-accent-text)",
          }}
          onMouseEnter={(e) =>
            !saving &&
            (e.currentTarget.style.backgroundColor =
              "var(--btn-accent-bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--btn-accent-bg)")
          }
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
