export interface AppSettings {
  theme: "light" | "dark";
  llmProvider: "openrouter" | "ollama";
  openrouterApiKey?: string;
  openrouterModel: string;
  openrouterMultimodalModel: string;
  ollamaModel: string;
  folders: string[];
  displayName: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  compactMode: boolean;
  confirmClearChat: boolean;
  autoLaunch: boolean;
  preferredLanguage: string;
  preferredLanguageCustomInfo: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  llmProvider: "openrouter",
  openrouterApiKey: "",
  openrouterModel: "openai/gpt-4o-mini",
  openrouterMultimodalModel: "",
  ollamaModel: "llama3.1:8b",
  folders: [],
  displayName: "",
  notificationsEnabled: true,
  soundEnabled: true,
  compactMode: false,
  confirmClearChat: true,
  autoLaunch: false,
  preferredLanguage: "english",
  preferredLanguageCustomInfo: "",
};

const SETTINGS_KEY = "app-settings";

export const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
};

export const resetSettings = (): AppSettings => {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.error("Failed to reset settings:", error);
  }
  return DEFAULT_SETTINGS;
};
