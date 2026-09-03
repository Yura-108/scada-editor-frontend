import { clampZoom } from "@/lib/editor/zoomLimits";
import type { Camera } from "@/lib/editor/revealCamera";
import type { SheetSize } from "@/lib/editor/sheet";

/** Запас вокруг листа, экранных пикселей. */
const DEFAULT_PAD = 40;

/**
 * Камера, при которой лист целиком помещается в видимую область.
 *
 * Вынесено из `useZoomControls.zoomFitSheet` отдельной чистой функцией: та же камера
 * нужна не только кнопке, но и первому открытию сцены (`useSceneCameraMemory` — сцена
 * без запомненной камеры показывается вписанной по листу). Формула обязана быть одна:
 * две копии разъехались бы молча, как когда-то разъехались границы зума.
 */
export function cameraForSheet(
  sheet: SheetSize,
  canvasRect: { width: number; height: number },
  pad: number = DEFAULT_PAD,
): Camera {
  const zoom = clampZoom(Math.min(
    canvasRect.width / (sheet.w + pad * 2),
    canvasRect.height / (sheet.h + pad * 2),
  ));

  return {
    x: (canvasRect.width - sheet.w * zoom) / 2,
    y: (canvasRect.height - sheet.h * zoom) / 2,
    zoom,
  };
}
