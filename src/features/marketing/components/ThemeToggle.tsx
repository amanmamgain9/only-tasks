"use client";

import { Moon, Sun } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { useTheme } from "@/app/providers";

type ThemeToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "aria-label">;

export default function ThemeToggle({ className = "", ...props }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
      {...props}
    >
      {isDark ? <Moon className="h-4 w-4 text-indigo-300" /> : <Sun className="h-4 w-4 text-amber-500" />}
    </button>
  );
}
