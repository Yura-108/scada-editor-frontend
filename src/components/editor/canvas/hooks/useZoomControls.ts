import { useCallback } from "react";
import { getElementBoundsRendered } from "@/lib/getElementBounds";
import { useEditorStore } from "@/store/useEditorStore";

const clampZoom = (z: number) => Math.min(Math.max(z, 0.2), 3);

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
    const roots = els.filter(el => el.parentKey === String(sc?.id));
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

  return { zoomBy, zoomFit };
}
