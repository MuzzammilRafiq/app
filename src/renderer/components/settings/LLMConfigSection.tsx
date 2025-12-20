import Input from "../../ui/input";
import { SearchableSelect } from "./SearchableSelect";
import type { AppSettings } from "../../services/settingsStorage";
import type { OpenRouterModel } from "../../../common/types";

interface LLMConfigSectionProps {
  settings: AppSettings;
  onSettingsChange: (updater: (prev: AppSettings) => AppSettings) => void;
  modelSelection: {
    primaryId: string;
    multimodalId: string;
  };
  onModelSelectionChange: (
    updater: (prev: { primaryId: string; multimodalId: string }) => {
      primaryId: string;
      multimodalId: string;
    }
  ) => void;
  models: OpenRouterModel[];
  textOnlyModels: OpenRouterModel[];
  multiModalModels: OpenRouterModel[];
  primaryIsTextOnly: boolean;
}

export function LLMConfigSection({
  settings,
  onSettingsChange,
  modelSelection,
  onModelSelectionChange,
  models,
  multiModalModels,
  primaryIsTextOnly,
}: LLMConfigSectionProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-slate-800">
        LLM Configuration
      </div>
      <div className="rounded-lg border border-gray-200 p-3 bg-white space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Provider
          </label>
          <select
            value={settings.llmProvider}
            onChange={(e) =>
              onSettingsChange((s) => ({
                ...s,
                llmProvider: e.target.value as AppSettings["llmProvider"],
              }))
            }
            className="w-full px-4 py-3 rounded-lg bg-white text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border border-gray-300 transition-all duration-200 cursor-pointer hover:border-gray-400 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')] bg-[length:1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10"
          >
            <option value="openrouter">OpenRouter</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
        {settings.llmProvider === "openrouter" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                OpenRouter API Key
              </label>
              <Input
                type="password"
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                OpenRouter Model
              </label>
              <SearchableSelect
                value={modelSelection.primaryId}
                onChange={(nextId) => {
                  const m = models.find((mm) => mm.id === nextId) || null;
                  const isTextOnly =
                    !!m &&
                    m.input_modalities.length === 1 &&
                    m.input_modalities[0] === "text";
                  onModelSelectionChange((prev) => ({
                    primaryId: nextId,
                    multimodalId: isTextOnly ? prev.multimodalId : nextId,
                  }));
                }}
                options={models}
                placeholder="Select a model"
                searchPlaceholder="Search models..."
                groups={[
                  {
                    label: "🎨 Multimodal Models",
                    filter: (m) =>
                      m.input_modalities.length > 1 ||
                      m.input_modalities[0] !== "text",
                  },
                  {
                    label: "📝 Text-only Models",
                    filter: (m) =>
                      m.input_modalities.length === 1 &&
                      m.input_modalities[0] === "text",
                  },
                ]}
              />
            </div>
            {primaryIsTextOnly && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Multimodal Model
                </label>
                <SearchableSelect
                  value={modelSelection.multimodalId}
                  onChange={(value) =>
                    onModelSelectionChange((prev) => ({
                      ...prev,
                      multimodalId: value,
                    }))
                  }
                  options={multiModalModels}
                  placeholder="Select a multimodal model"
                  searchPlaceholder="Search multimodal models..."
                />
                {!modelSelection.multimodalId && (
                  <div className="text-xs text-red-600">
                    Select a model for image input
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {settings.llmProvider === "ollama" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Ollama Model
              </label>
              <Input
                type="text"
                placeholder="e.g., llama3.1:8b"
                value={settings.ollamaModel}
                onChange={(e) =>
                  onSettingsChange((s) => ({
                    ...s,
                    ollamaModel: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 border border-gray-300"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
