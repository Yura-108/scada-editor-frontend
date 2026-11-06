import {useCallback, useState} from "react";

/** localStorage может быть недоступен (приватный режим, запрет сайта) — тогда просто без памяти. */
const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // без памяти между заходами — не страшно
  }
};

export interface SidePanelSize {
  min: number;
  max: number;
  initial: number;
}

/**
 * Открыта ли боковая панель и какой ширины — помнит браузер под `${storageKey}.open` / `.width`.
 *
 * Панель появляется только после загрузки набора в браузере, на сервере она не рендерится —
 * поэтому localStorage можно читать прямо в начальном состоянии.
 */
export function useSidePanelState(storageKey: string, size: SidePanelSize) {
  const clamp = useCallback(
    (w: number) => Math.min(size.max, Math.max(size.min, Math.round(w))),
    [size.max, size.min],
  );
  const [open, setOpenState] = useState(() => readStored(`${storageKey}.open`) !== "0");
  const [width, setWidth] = useState(() => clamp(Number(readStored(`${storageKey}.width`)) || size.initial));

  const setOpen = (next: boolean) => {
    setOpenState(next);
    writeStored(`${storageKey}.open`, next ? "1" : "0");
  };

  /** Ширина во время перетаскивания — без записи; `commitWidth` — с записью. */
  const previewWidth = (w: number) => setWidth(clamp(w));
  const commitWidth = (w: number) => {
    const next = clamp(w);
    setWidth(next);
    writeStored(`${storageKey}.width`, String(next));
  };

  return {open, setOpen, width, previewWidth, commitWidth};
}
