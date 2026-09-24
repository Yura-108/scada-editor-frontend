import type {CSSProperties} from "react";
import type {OptionsWindowSettings} from "@/types/editorElement.type";

/**
 * Окно «Опции» в мониторе: размер и шрифт, заданные компоненту в редакторе.
 *
 * Пределы выбраны так, чтобы окно оставалось читаемым и не теряло кнопок: меньше 320 px
 * по ширине строка с полем ввода и кнопкой «Записать» уже не помещается.
 */
export const OPTIONS_WINDOW_LIMITS = {
  width: {min: 320, max: 1600},
  height: {min: 200, max: 1200},
  fontSize: {min: 10, max: 32},
} as const;

/** Шрифт окна по умолчанию — прежний `text-sm`. */
export const DEFAULT_OPTIONS_FONT_SIZE = 14;

const KEYS = ["width", "height", "fontSize"] as const;

/**
 * Разбор настроек из image или элемента. Берёт только конечные числа и зажимает их в
 * пределы: данные едут внутри непрозрачного JSON, и мусор в нём не должен ломать окно.
 * Ничего не задано — `undefined`, чтобы элемент без настроек не таскал пустой объект.
 */
export function readOptionsWindow(raw: unknown): OptionsWindowSettings | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const src = raw as Record<string, unknown>;
  const result: OptionsWindowSettings = {};
  for (const key of KEYS) {
    const v = typeof src[key] === "number" ? src[key] : Number(src[key]);
    if (src[key] == null || src[key] === "" || !Number.isFinite(v)) continue;
    const {min, max} = OPTIONS_WINDOW_LIMITS[key];
    result[key] = Math.round(Math.min(max, Math.max(min, v)));
  }
  return Object.keys(result).length ? result : undefined;
}

/**
 * Стиль для `Dialog.Content`. Экран оператора бывает меньше заданного размера, поэтому
 * верхние границы в vw/vh остаются: окно ужимается, но не выходит за край.
 */
export function optionsWindowStyle(s: OptionsWindowSettings | undefined): CSSProperties | undefined {
  if (!s?.width && !s?.height) return undefined;
  return {
    ...(s.width ? {width: s.width, maxWidth: "95vw"} : {}),
    ...(s.height ? {height: s.height, maxHeight: "92vh"} : {}),
  };
}
