import { useEditorStore } from "@/store/useEditorStore";

/**
 * Возвращает курсор «покоя» для холста.
 *
 * Пока в палитре «вооружён» инструмент, курсор должен оставаться прицелом.
 * Раньше каждая фигура на mouse-leave безусловно писала "default", поэтому
 * достаточно было провести мышью над любым элементом — и прицел пропадал до
 * повторного клика по палитре.
 */
export const restingCanvasCursor = (): string =>
  useEditorStore.getState().pendingPlacement ? "crosshair" : "default";

/** Сбрасывает курсор контейнера холста с учётом «вооружённого» инструмента. */
export const resetCanvasCursor = (container: HTMLElement | undefined | null) => {
  if (container) container.style.cursor = restingCanvasCursor();
};
