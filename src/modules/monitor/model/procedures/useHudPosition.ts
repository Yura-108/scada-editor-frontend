import React, {useCallback, useEffect, useRef, useState} from "react";
import {
  clampHudPosition, DEFAULT_HUD_PREFS, isRightAligned, readHudPrefs, writeHudPrefs,
  type HudPrefs,
} from "../../lib/procedureHudPrefs";

/** Отступ от краёв области схемы. */
const MARGIN = 8;

/** Запись настройки с задержкой — как у остальных localStorage-помощников проекта. */
const SAVE_DELAY_MS = 300;

/**
 * Положение и свёрнутость HUD процедуры: чтение настройки после монтирования, сохранение
 * с задержкой и перетаскивание за шапку. `hudRef` вешается на корень HUD, область — его родитель.
 */
export function useHudPosition() {
  const hudRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<HudPrefs>(DEFAULT_HUD_PREFS);
  const [hydrated, setHydrated] = useState(false);

  /**
   * Настройку читаем ПОСЛЕ монтирования, а не в инициализаторе `useState`: на сервере
   * localStorage нет, и разметка разошлась бы с клиентской (то же правило в WorkSpace
   * и useSceneCameraMemory).
   */
  useEffect(() => {
    const saved = readHudPrefs();
    const node = hudRef.current;
    const area = node?.parentElement;

    if (node && area) {
      const box = node.getBoundingClientRect();
      const size = {width: box.width, height: box.height};
      const bounds = {width: area.clientWidth, height: area.clientHeight};
      // `x < 0` — «прижать к правому краю»: ширину узнаём только сейчас.
      const x = isRightAligned(saved.x) ? bounds.width - size.width - MARGIN : saved.x;
      setPrefs({...saved, ...clampHudPosition(x, saved.y, size, bounds, MARGIN)});
    } else {
      setPrefs(saved);
    }
    setHydrated(true);
  }, []);

  // Сохранение с задержкой: перетаскивание иначе писало бы в localStorage на каждый кадр.
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => writeHudPrefs(prefs), SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [prefs, hydrated]);

  /**
   * Перетаскивание за шапку.
   *
   * Во время жеста двигаем узел напрямую через `style`, а в состояние React пишем только
   * на `pointerup` — тот же приём, что у ручек панелей в `WorkSpace`: иначе выходят сотни
   * перерисовок за одно перетаскивание.
   */
  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const node = hudRef.current;
    const area = node?.parentElement;
    if (!node || !area || e.button !== 0) return;

    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const box = node.getBoundingClientRect();
    const areaBox = area.getBoundingClientRect();
    const grabX = e.clientX - box.left;
    const grabY = e.clientY - box.top;
    const size = {width: box.width, height: box.height};
    const bounds = {width: area.clientWidth, height: area.clientHeight};

    let next = {x: box.left - areaBox.left, y: box.top - areaBox.top};

    const onMove = (ev: PointerEvent) => {
      next = clampHudPosition(
        ev.clientX - areaBox.left - grabX,
        ev.clientY - areaBox.top - grabY,
        size, bounds, MARGIN,
      );
      node.style.left = `${next.x}px`;
      node.style.top = `${next.y}px`;
    };

    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setPrefs(prev => ({...prev, ...next}));
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, []);

  const toggleCollapsed = () => setPrefs(prev => ({...prev, collapsed: !prev.collapsed}));

  return {hudRef, prefs, hydrated, handleDragStart, toggleCollapsed};
}
