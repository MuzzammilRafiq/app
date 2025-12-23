import type { AppSettings } from "../../services/settingsStorage";

interface LLMConfigSectionProps {
  settings: AppSettings;
  onSettingsChange: (updater: (prev: AppSettings) => AppSettings) => void;
}

export function LLMConfigSection({
  settings,
  onSettingsChange,
}: LLMConfigSectionProps) {
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
            <input
              type="text"
              placeholder="sk-or-v1-..."
              value={settings.openrouterApiKey || ""}
              onChange={(e) =>
                onSettingsChange((s) => ({
                  ...s,
                  openrouterApiKey: e.target.value,
                }))
              }
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 border border-gray-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
