"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "planmyworkday-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeListeners = new Set<() => void>();

function normalizeTheme(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : "dark";
}

function readThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "dark";
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

function readServerThemeSnapshot(): Theme {
  return "dark";
}

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) listener();
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function notifyThemeListeners() {
  themeListeners.forEach((listener) => listener());
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, readThemeSnapshot, readServerThemeSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    notifyThemeListeners();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [setTheme, theme, toggleTheme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const value = use(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside Providers.");
  }
  return value;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
