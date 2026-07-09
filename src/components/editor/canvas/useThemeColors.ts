import { useTheme } from "next-themes";
import type { ThemeColors } from "./types";

export function useThemeColors(): { resolvedTheme: string | undefined; isDark: boolean; themeColors: ThemeColors } {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const themeColors: ThemeColors = {
    textDefault:   isDark ? "#ffffff" : "#1a1a1a",
    labelDefault:  isDark ? "#ffffff" : "#000000",
    strokeDefault: isDark ? "#9ca3af" : "#6b7280",
    canvasBg:      isDark ? "#0a0a0a" : "#ffffff",
    gridLine:      isDark ? "rgba(100,100,120,0.4)" : "rgba(0,0,0,0.07)",
    anchorFill:    isDark ? "#ffffff" : "#1a1a1a",
    anchorStroke:  "#3b82f6",
  };

  return { resolvedTheme, isDark, themeColors };
}
