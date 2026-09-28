import { useCallback } from "react";
import { getElementBoundsRendered } from "@/lib/getElementBounds";
import { useEditorStore } from "@/store/useEditorStore";
import { clampZoom } from "@/lib/editor/zoomLimits";
import { resolveSheet } from "@/lib/editor/sheet";
import { cameraForSheet } from "@/lib/editor/fitCamera";

interface ZoomControlsDeps {
  canvasRect: { width: number; height: number } | null;
  setCamera: (x: number, y: number, zoom: number) => void;
}

/**
 * Следующий масштаб при шаге кнопкой: ровно ±1 процентный пункт, с выравниванием на целый
 * процент. Масштаб с дробным процентом (после колеса или «вписать», например 37.4%) первым
 * нажатием встаёт на ближайший целый в сторону шага — 38% или 37%, — а дальше идёт по
 * единице, чтобы нужный зум можно было выставить точно.
 */
export function stepZoomPercent(zoom: number, direction: 1 | -1): number {
  const pct = zoom * 100;
  // Допуск: 0.29 * 100 = 28.999999999999996 — это 29%, а не «чуть меньше 29».
  const eps = 1e-6;
  const next = direction > 0 ? Math.floor(pct + eps) + 1 : Math.ceil(pct - eps) - 1;
  return clampZoom(next / 100);
}

/**
 * Логика zoom-панели: приближение вокруг центра видимой области и fit-to-content.
 *
 * Замок вида (lib/editor/monitorView.ts) здесь не проверяется: в редакторе масштаб
 * свободен всегда, а в мониторе с зафиксированным видом панели с этими кнопками нет.
 */
export function useZoomControls({ canvasRect, setCamera }: ZoomControlsDeps) {
  /** Кнопки «−»/«+»: шаг ровно в 1% (см. stepZoomPercent). */
  const zoomStep = useCallback((direction: 1 | -1) => {
    // Зумируем вокруг центра видимой области, чтобы картинка не «уезжала».
    const cx = (canvasRect?.width ?? 800) / 2;
    const cy = (canvasRect?.height ?? 600) / 2;
    const cam = useEditorStore.getState().camera;
    const nz = stepZoomPercent(cam.zoom, direction);
    if (nz === cam.zoom) return;
    setCamera(cx - ((cx - cam.x) * nz) / cam.zoom, cy - ((cy - cam.y) * nz) / cam.zoom, nz);
  }, [canvasRect, setCamera]);

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
    const nz = clampZoom(Math.min(
      canvasRect.width / (maxX - minX + pad * 2),
      canvasRect.height / (maxY - minY + pad * 2),
    ));
    setCamera(
      (canvasRect.width - (maxX - minX) * nz) / 2 - minX * nz,
      (canvasRect.height - (maxY - minY) * nz) / 2 - minY * nz,
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
    const cam = cameraForSheet(resolveSheet(useEditorStore.getState().elements), canvasRect);
    setCamera(cam.x, cam.y, cam.zoom);
  }, [canvasRect, setCamera]);

  return { zoomStep, zoomFit, zoomFitSheet };
}
