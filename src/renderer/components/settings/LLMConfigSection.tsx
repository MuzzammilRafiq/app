import { useState } from "react";
import type { AppSettings } from "../../services/settingsStorage";
import { EyeIcon, EyeOffIcon } from "../icons";

interface LLMConfigSectionProps {
  settings: AppSettings;
  onSettingsChange: (updater: (prev: AppSettings) => AppSettings) => void;
}

export function LLMConfigSection({
  settings,
  onSettingsChange,
}: LLMConfigSectionProps) {
  const [showKey, setShowKey] = useState(false);
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-slate-800">
        LLM Configuration
      </div>
      <div className="rounded-lg border border-gray-200 p-3 bg-white space-y-4">
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
                  onSettingsChange((s) => ({
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
        </div>
      </div>
    </div>
  );
}
