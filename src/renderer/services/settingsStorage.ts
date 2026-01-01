export interface AppSettings {
  theme: "light" | "dark";
  openrouterApiKey?: string;
  folders: string[];
  textModel?: string;
  imageModel?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  openrouterApiKey: "",
  folders: [],
  textModel: "",
  imageModel: "",
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
