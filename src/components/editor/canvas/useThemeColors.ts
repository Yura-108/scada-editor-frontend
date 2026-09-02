import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { ThemeColors } from "./types";

export function useThemeColors(): { resolvedTheme: string | undefined; isDark: boolean; themeColors: ThemeColors } {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Мемоизируем: объект входит в deps рендер-контекста Canvas — нестабильная ссылка
  // ломала бы мемоизацию всех фигур (ре-рендер всей сцены на каждый чих).
  // Цвета холста задаются ТОЛЬКО здесь. Раньше половина была захардкожена прямо
  // в фигурах, и выделение существовало в двух разных синих (#3b82f6 у обводки
  // и #0096ff у рамки-протяжки) — оба видны одновременно при протяжке рамки.
  const themeColors: ThemeColors = useMemo(() => {
    const selection = isDark ? "#60a5fa" : "#3b82f6";

    return {
      textDefault:   isDark ? "#ffffff" : "#1a1a1a",
      labelDefault:  isDark ? "#ffffff" : "#000000",
      strokeDefault: isDark ? "#9ca3af" : "#6b7280",
      canvasBg:      isDark ? "#0a0a0a" : "#ffffff",
      // «Стол» вокруг листа — темнее самого листа, чтобы край листа читался
      // без жирной рамки.
      deskBg:        isDark ? "#000000" : "#e8e8ec",
      sheetBorder:   isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)",
      gridLine:      isDark ? "rgba(100,100,120,0.4)" : "rgba(0,0,0,0.07)",
      // Крупный шаг сетки заметнее мелкого — иначе на среднем зуме они сливаются.
      gridLineMajor: isDark ? "rgba(120,120,145,0.6)" : "rgba(0,0,0,0.14)",
      anchorFill:    isDark ? "#ffffff" : "#1a1a1a",
      anchorStroke:  selection,
      selection,
      selectionFill: isDark ? "rgba(96,165,250,0.22)" : "rgba(59,130,246,0.18)",
      handleFill:    isDark ? "#0a0a0a" : "#ffffff",
      activeGroup:   isDark ? "#fbbf24" : "#f59e0b",
      guide:         isDark ? "#fb7185" : "#f43f5e",
    };
  }, [isDark]);

  return { resolvedTheme, isDark, themeColors };
}
