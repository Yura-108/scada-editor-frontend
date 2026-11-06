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
 *
 * Плашку, которую ни разу не двигали, держит у правого края CSS `right`, а не вычисленный
 * `left`: без рецепта она узкая, с рецептом — широкая, и должна расти влево, а не за край (#6 п. 1).
 */
export function useHudPosition(
  /** Что меняет ширину плашки (выбранный рецепт): при смене — вписать заново, не дожидаясь ResizeObserver. */
  layoutKey: unknown,
) {
  const hudRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<HudPrefs>(DEFAULT_HUD_PREFS);
  const [hydrated, setHydrated] = useState(false);
  /**
   * Куда плашку пришлось подвинуть, чтобы она осталась в области: окно сузили или плашка
   * расширилась. Только для показа — сохранённое место не трогаем, вернётся простор — вернётся и она.
   */
  const [fit, setFit] = useState<{x: number; y: number} | null>(null);

  /**
   * Настройку читаем ПОСЛЕ монтирования, а не в инициализаторе `useState`: на сервере
   * localStorage нет, и разметка разошлась бы с клиентской (то же правило в WorkSpace
   * и useSceneCameraMemory).
   */
  useEffect(() => {
    // Вписать в область сразу, до первого кадра: иначе окно на миг встало бы за краем.
    // Прижатую вправо оставляем прижатой (`x < 0`) — её ведёт CSS `right`.
    const saved = readHudPrefs();
    const node = hudRef.current;
    const area = node?.parentElement;

    if (node && area) {
      const size = {width: node.offsetWidth, height: node.offsetHeight};
      const bounds = {width: area.clientWidth, height: area.clientHeight};
      const fitted = clampHudPosition(saved.x, saved.y, size, bounds, MARGIN);
      setPrefs({...saved, x: isRightAligned(saved.x) ? saved.x : fitted.x, y: fitted.y});
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

  // Следим за размером плашки и области: обе меняются (выбор рецепта, шаги, ширина окна).
  useEffect(() => {
    const node = hudRef.current;
    const area = node?.parentElement;
    if (!hydrated || !node || !area) return;

    const refit = () => {
      const size = {width: node.offsetWidth, height: node.offsetHeight};
      const bounds = {width: area.clientWidth, height: area.clientHeight};
      // У прижатой вправо `x` — тот, что дал бы `right: MARGIN`; важен только `y`.
      const x = isRightAligned(prefs.x) ? bounds.width - size.width - MARGIN : prefs.x;
      const next = clampHudPosition(x, prefs.y, size, bounds, MARGIN);
      setFit(next.x === x && next.y === prefs.y ? null : next);
    };

    refit();
    const observer = new ResizeObserver(refit);
    observer.observe(node);
    observer.observe(area);
    return () => observer.disconnect();
  }, [prefs, hydrated, layoutKey]);

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
    // Прижатую вправо с первого движения ведём через `left`, как любую сдвинутую.
    node.style.right = "";

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
      setFit(null);
      setPrefs(prev => ({...prev, ...next}));
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, []);

  const toggleCollapsed = () => setPrefs(prev => ({...prev, collapsed: !prev.collapsed}));

  const shown = fit ?? prefs;
  const style: React.CSSProperties = isRightAligned(prefs.x) && !fit
    ? {right: MARGIN, top: shown.y}
    : {left: shown.x, top: shown.y};

  return {hudRef, prefs, style, hydrated, handleDragStart, toggleCollapsed};
}
