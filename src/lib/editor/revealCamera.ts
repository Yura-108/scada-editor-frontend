import { ElementBounds } from "@/lib/getElementBounds";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Запас от края видимой области, экранных пикселей. */
const DEFAULT_PAD = 40;

/**
 * Камера, при которой габарит элемента попадает в видимую область, или `null` —
 * значит он уже виден и двигать ничего не надо.
 *
 * Зум намеренно не меняется: подвод к элементу не должен сбивать масштаб, в котором
 * человек работает (этим отличается от «вписать схему» в `useZoomControls`). Элемент
 * крупнее экрана просто центрируется — показать его целиком без смены зума нельзя.
 *
 * Мир → экран здесь ровно та же алгебра, что у трансформа Stage в Canvas:
 * `screen = world * zoom + camera`.
 */
export function cameraToReveal(
  bounds: ElementBounds,
  camera: Camera,
  canvasRect: { width: number; height: number },
  pad: number = DEFAULT_PAD,
): Camera | null {
  const { zoom } = camera;
  const { width, height } = canvasRect;
  if (!width || !height) return null;

  const left = bounds.minX * zoom + camera.x;
  const top = bounds.minY * zoom + camera.y;
  const right = bounds.maxX * zoom + camera.x;
  const bottom = bounds.maxY * zoom + camera.y;

  // Запас не может быть больше половины экрана, иначе у мелкого окна «видимой»
  // области не остаётся вовсе и камера ехала бы на каждый клик.
  const padX = Math.min(pad, width / 2);
  const padY = Math.min(pad, height / 2);

  const visible =
    left >= padX && top >= padY && right <= width - padX && bottom <= height - padY;
  if (visible) return null;

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  return {
    x: width / 2 - cx * zoom,
    y: height / 2 - cy * zoom,
    zoom,
  };
}
