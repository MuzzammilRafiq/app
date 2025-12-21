import { useState } from "react";
import toast from "react-hot-toast";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "../../services/settingsStorage";
import { useQuery } from "@tanstack/react-query";
import type { OpenRouterModel } from "../../../common/types";
import { LLMConfigSection } from "./LLMConfigSection";

export default function AdvancedSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [saving, setSaving] = useState(false);
  const [modelSelection, setModelSelection] = useState<{
    primaryId: string;
    multimodalId: string;
  }>(() => ({
    primaryId: settings.openrouterModel || "",
    multimodalId: "",
  }));

  const query = useQuery({
    queryKey: ["openrouter_models", settings.openrouterApiKey],
    queryFn: () =>
      window.electronAPI?.getOpenRouterModels(settings.openrouterApiKey || ""),
    refetchInterval: 60 * 60 * 1000,
    enabled: settings.llmProvider === "openrouter",
  });
  const models = (query.data || []) as OpenRouterModel[];
  const textOnlyModels: OpenRouterModel[] = [];
  const multiModalModels: OpenRouterModel[] = [];
  for (const model of models) {
    if (
      model.input_modalities.length === 1 &&
      model.input_modalities[0] === "text"
    ) {
      textOnlyModels.push(model);
    } else {
      multiModalModels.push(model);
    }
  }
  const selectedPrimaryModel =
    models.find((m) => m.id === modelSelection.primaryId) || null;
  const primaryIsTextOnly =
    !!selectedPrimaryModel &&
    selectedPrimaryModel.input_modalities.length === 1 &&
    selectedPrimaryModel.input_modalities[0] === "text";

  const onSave = () => {
    setSaving(true);
    try {
      const payload = {
        ...settings,
        openrouterModel: modelSelection.primaryId,
        openrouterMultimodalModel: primaryIsTextOnly
          ? modelSelection.multimodalId
          : modelSelection.primaryId,
      } as unknown as AppSettings;
      saveSettings(payload);
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <LLMConfigSection
        settings={settings}
        onSettingsChange={setSettings}
        modelSelection={modelSelection}
        onModelSelectionChange={setModelSelection}
        models={models}
        textOnlyModels={textOnlyModels}
        multiModalModels={multiModalModels}
        primaryIsTextOnly={primaryIsTextOnly}
      />

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onSave}
          disabled={
            saving ||
            (settings.llmProvider === "openrouter" &&
              primaryIsTextOnly &&
              !modelSelection.multimodalId)
          }
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
            saving ||
            (settings.llmProvider === "openrouter" &&
              primaryIsTextOnly &&
              !modelSelection.multimodalId)
              ? "opacity-50 cursor-not-allowed"
              : ""
          } bg-blue-600 text-white hover:bg-blue-700`}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
