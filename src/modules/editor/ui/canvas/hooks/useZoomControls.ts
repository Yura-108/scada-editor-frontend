import { useCallback } from "react";
import {getElementBoundsRendered, clampZoom, resolveSheet} from "@/core/scene";
import {useEditorStore} from "../../../model/editorStore";
import { cameraForSheet } from "../../../lib/fitCamera";
import { visibleCanvasArea } from "../lib/visibleArea";

interface ZoomControlsDeps {
  canvasRect: { width: number; height: number } | null;
  setCamera: (x: number, y: number, zoom: number) => void;
}

/**
 * Ряд масштабов кнопок «−»/«+», в процентах. Раньше шаг был ровно 1%: от 8% новой схемы до
 * 100% — 92 нажатия (#18 п. 2). Точный процент теперь вводится в поле масштаба.
 */
const ZOOM_LADDER = [3, 5, 8, 10, 15, 20, 25, 33, 50, 67, 75, 100, 125, 150, 200, 250, 300];

/**
 * Следующий масштаб при шаге кнопкой: ближайшее значение ряда строго больше (меньше)
 * текущего. С любого масштаба (после колеса или «вписать», например 37.4%) первое нажатие
 * встаёт на значение ряда — 50% или 33%.
 */
export function stepZoomPercent(zoom: number, direction: 1 | -1): number {
  const pct = zoom * 100;
  // Допуск: 0.29 * 100 = 28.999999999999996 — это 29%, а не «чуть меньше 29».
  const eps = 1e-6;
  const next = direction > 0
    ? ZOOM_LADDER.find(p => p > pct + eps)
    : [...ZOOM_LADDER].reverse().find(p => p < pct - eps);
  return clampZoom((next ?? pct) / 100);
}

/**
 * Логика zoom-панели: приближение вокруг центра видимой области и fit-to-content.
 *
 * Замок вида (core/scene/sheet/monitorView.ts) здесь не проверяется: в редакторе масштаб
 * свободен всегда, а в мониторе с зафиксированным видом панели с этими кнопками нет.
 */
export function useZoomControls({ canvasRect, setCamera }: ZoomControlsDeps) {
  /** Масштаб `zoom` вокруг центра видимой области, чтобы картинка не «уезжала». */
  const zoomTo = useCallback((zoom: number) => {
    const cx = (canvasRect?.width ?? 800) / 2;
    const cy = (canvasRect?.height ?? 600) / 2;
    const cam = useEditorStore.getState().camera;
    const nz = clampZoom(zoom);
    if (nz === cam.zoom) return;
    setCamera(cx - ((cx - cam.x) * nz) / cam.zoom, cy - ((cy - cam.y) * nz) / cam.zoom, nz);
  }, [canvasRect, setCamera]);

  /** Кнопки «−»/«+»: по ряду масштабов (см. stepZoomPercent). */
  const zoomStep = useCallback((direction: 1 | -1) => {
    zoomTo(stepZoomPercent(useEditorStore.getState().camera.zoom, direction));
  }, [zoomTo]);

  const zoomFit = useCallback(() => {
    if (!canvasRect) return;
    const { elements: els, scene: sc } = useEditorStore.getState();
    // `visible: false` (служебный элемент импорта) в габарит не входит: он стоит в (0, 0)
    // нулевого размера и растянул бы «вписать в экран» до начала координат.
    const roots = els.filter(el => el.parentKey === String(sc?.id) && el.visible !== false);
    if (!roots.length) { setCamera(0, 0, 1); return; }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of roots) {
      const b = getElementBoundsRendered(el, els);
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    }
    if (!isFinite(minX)) return;

    const pad = 60;
    // Вписываем в видимую часть, а не во весь холст: он лежит и под боковыми панелями, и под
    // панелью инструментов (#10 п. 2).
    const area = visibleCanvasArea(canvasRect);
    const nz = clampZoom(Math.min(
      area.width / (maxX - minX + pad * 2),
      area.height / (maxY - minY + pad * 2),
    ));
    setCamera(
      area.x + (area.width - (maxX - minX) * nz) / 2 - minX * nz,
      area.y + (area.height - (maxY - minY) * nz) / 2 - minY * nz,
      nz,
    );
  }, [canvasRect, setCamera]);

  /**
   * Вписать ЛИСТ (а не содержимое).
   *
   * Отдельная кнопка нужна потому, что читаемым целиком не открывается ни один
   * формат: подпись устройства (кегль 80 единиц по договорённости с CONTUR) читается
   * примерно с зума 0.10 — типовой A3 в него как раз вписывается, а плотный лист и A0
   * уже нет. Переход «весь лист - рабочий зум» из-за этого частый.
   */
  const zoomFitSheet = useCallback(() => {
    if (!canvasRect) return;
    // Формула — в общем хелпере: той же камерой открывается сцена, у которой ещё нет
    // запомненного положения (см. useSceneCameraMemory).
    const cam = cameraForSheet(resolveSheet(useEditorStore.getState().elements), visibleCanvasArea(canvasRect));
    setCamera(cam.x, cam.y, cam.zoom);
  }, [canvasRect, setCamera]);

  return { zoomStep, zoomTo, zoomFit, zoomFitSheet };
}
