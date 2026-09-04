import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext.js";

type ThemeToggleProps = {
  className?: string;
  size?: number;
};

export function ThemeToggle({ className = "", size = 16 }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl border border-hairline bg-surface-2 hover:bg-surface-3 text-parchment hover:text-ember transition cursor-pointer flex items-center justify-center shadow-xs select-none active:scale-95 ${className}`}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? (
        <Sun size={size} aria-hidden="true" className="text-ember" />
      ) : (
        <Moon size={size} aria-hidden="true" className="text-clay hover:text-parchment" />
      )}
    </button>
  );
}
