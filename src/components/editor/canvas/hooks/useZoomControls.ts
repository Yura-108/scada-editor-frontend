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

/** Логика zoom-панели: приближение вокруг центра видимой области и fit-to-content. */
export function useZoomControls({ canvasRect, setCamera }: ZoomControlsDeps) {
  const zoomBy = useCallback((factor: number) => {
    // Зумируем вокруг центра видимой области, чтобы картинка не «уезжала».
    const cx = (canvasRect?.width ?? 800) / 2;
    const cy = (canvasRect?.height ?? 600) / 2;
    const cam = useEditorStore.getState().camera;
    const nz = clampZoom(cam.zoom * factor);
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

  return { zoomBy, zoomFit, zoomFitSheet };
}
