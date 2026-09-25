import type {CSSProperties} from "react";
import type {MonitorMenuSettings} from "@/types/editorElement.type";

/**
 * Контекстное меню компонента в мониторе (ПКМ: «Опции», действия вроде «Открыть клапан»):
 * ширина плашки, шрифт и высота пункта, заданные компоненту в редакторе.
 *
 * Зачем: монитор часто работает на сенсорной панели, и стандартный пункт в 36 px под палец
 * мал, а на большом щите мелкий шрифт не читается. Настройка — на компонент, потому что
 * одно и то же меню у задвижки и у насоса может быть разным по длине подписей.
 */
export const MONITOR_MENU_LIMITS = {
  width: {min: 120, max: 600},
  fontSize: {min: 10, max: 32},
  itemHeight: {min: 24, max: 96},
} as const;

/** Значения по умолчанию — то, как меню выглядело до настройки (text-sm, py-2). */
export const MONITOR_MENU_DEFAULTS = {fontSize: 14, itemHeight: 36} as const;

const KEYS = ["width", "fontSize", "itemHeight"] as const;

/**
 * Разбор настроек из image или элемента. Берёт только конечные числа и зажимает их в
 * пределы: данные едут внутри непрозрачного JSON, и мусор в нём не должен ломать меню.
 * Ничего не задано — `undefined`, чтобы элемент без настроек не таскал пустой объект.
 */
export function readMonitorMenu(raw: unknown): MonitorMenuSettings | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const src = raw as Record<string, unknown>;
  const result: MonitorMenuSettings = {};
  for (const key of KEYS) {
    if (src[key] == null || src[key] === "") continue;
    const v = typeof src[key] === "number" ? src[key] : Number(src[key]);
    if (!Number.isFinite(v)) continue;
    const {min, max} = MONITOR_MENU_LIMITS[key];
    result[key] = Math.round(Math.min(max, Math.max(min, v)));
  }
  return Object.keys(result).length ? result : undefined;
}

/**
 * Стили плашки и пункта. Ширина — точная (длинная подпись переносится, а не растягивает
 * меню), но не шире экрана. Высота пункта — минимальная: перенесённая на две строки
 * подпись не должна обрезаться.
 */
export function monitorMenuStyles(s: MonitorMenuSettings | undefined): {
  panel?: CSSProperties;
  item?: CSSProperties;
} {
  if (!s) return {};
  return {
    panel: s.width ? {width: s.width, maxWidth: "calc(100vw - 16px)"} : undefined,
    item: s.fontSize || s.itemHeight || s.width
      ? {
        ...(s.fontSize ? {fontSize: s.fontSize} : {}),
        ...(s.itemHeight ? {minHeight: s.itemHeight} : {}),
        ...(s.width ? {whiteSpace: "normal", overflowWrap: "anywhere"} : {}),
      }
      : undefined,
  };
}
