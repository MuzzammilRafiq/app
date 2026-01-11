import { useEffect } from "react";
import { create } from "zustand";
import { loadSettings, saveSettings } from "../utils/localstore";

type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Apply theme class to HTML element
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

// Zustand store for theme state
export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: loadSettings().theme || "light",

  setTheme: (theme: Theme) => {
    applyTheme(theme);
    // Persist to localStorage
    const settings = loadSettings();
    saveSettings({ ...settings, theme });
    set({ theme });
  },

  toggleTheme: () => {
    const currentTheme = get().theme;
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    get().setTheme(newTheme);
  },
}));

// Hook to initialize theme on mount
export const useThemeInit = () => {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    // Apply theme on initial mount
    applyTheme(theme);
  }, []);

  return theme;
};

// Convenience hook for components
export const useTheme = () => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
};
