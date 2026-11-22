"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = "bank-buddy-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Determine system preference
  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  // Apply theme to DOM documentElement and <meta name="color-scheme">
  const applyTheme = useCallback(
    (mode: ThemeMode) => {
      if (typeof window === "undefined") return;

      const effective: "light" | "dark" = mode === "system" ? getSystemTheme() : mode;
      setResolvedTheme(effective);

      const root = document.documentElement;
      if (mode === "system") {
        root.dataset.theme = effective;
      } else {
        root.dataset.theme = mode;
      }

      // Sync color-scheme meta tag for browser UI (scrollbars, form controls)
      const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
      if (meta) {
        meta.content = mode === "system" ? "light dark" : effective;
      }
    },
    [getSystemTheme]
  );

  // Initialize theme from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      const initialMode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
      setThemeState(initialMode);
      applyTheme(initialMode);
    } catch {
      applyTheme("system");
    }

    // Media query listener for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      const currentSaved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (!currentSaved || currentSaved === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);

    // Cross-tab storage sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const newMode = (e.newValue as ThemeMode) || "system";
        setThemeState(newMode);
        applyTheme(newMode);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [applyTheme]);

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch (err) {
        console.warn("[ThemeProvider] Failed to persist theme:", err);
      }
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
