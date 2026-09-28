import type { DiagramElement } from "@/types/editorElement.type";
import type { Camera } from "@/lib/editor/revealCamera";
import type { SheetSize } from "@/lib/editor/sheet";
import { isMetaElement } from "@/lib/editor/sheet";
import { clampZoom } from "@/lib/editor/zoomLimits";

/**
 * Вид сцены для монитора, зафиксированный инженером (замок в панели зума редактора).
 *
 * Инженер выставляет камеру в редакторе и жмёт замок — запоминается видимая ОБЛАСТЬ схемы
 * в мировых координатах, а не камера: экран монитора другого размера, чем холст редактора
 * (у того по бокам панели), и экранные x/y/zoom на нём показали бы не то. В мониторе
 * ширина области вписывается во всю ширину холста, верхний край совпадает, и дальше
 * оператор может только прокручивать схему колесом по вертикали — в пределах листа.
 *
 * Живёт в служебном элементе сцены рядом с размером листа (`isMetaElement`), поэтому
 * уезжает на сервер с сохранением сцены и доходит до монитора на любом компьютере. В
 * редакторе на камеру не влияет: там масштаб и пан свободны.
 */
export interface MonitorView {
  /** Левый верхний угол области, мировые единицы. */
  x: number;
  y: number;
  /** Ширина области — её монитор вписывает во всю ширину холста. */
  w: number;
  /**
   * Высота области у инженера в момент фиксации. Только для рамки в редакторе: в мониторе
   * высота определяется экраном, по вертикали там прокручивают.
   */
  h: number;
}

const finite = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Разбор из элемента или image: мусор в непрозрачном JSON не должен ломать монитор. */
export function readMonitorView(raw: unknown): MonitorView | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const src = raw as Record<string, unknown>;
  const x = finite(src.x);
  const y = finite(src.y);
  const w = finite(src.w);
  const h = finite(src.h);
  if (x === null || y === null || w === null || w <= 0) return undefined;
  return { x, y, w, h: h !== null && h > 0 ? h : w };
}

/** Кэш по ссылке на массив — тот же приём, что у `resolveSheet`. */
const viewCache = new WeakMap<DiagramElement[], MonitorView | null>();

/** Зафиксированный вид сцены или null, если инженер его не задавал. */
export function resolveMonitorView(elements: DiagramElement[]): MonitorView | null {
  const cached = viewCache.get(elements);
  if (cached !== undefined) return cached;
  let view: MonitorView | null = null;
  for (const el of elements) {
    if (!isMetaElement(el)) continue;
    view = readMonitorView((el as unknown as Record<string, unknown>).monitorView) ?? null;
    if (view) break;
  }
  viewCache.set(elements, view);
  return view;
}

/** Что сейчас видно на холсте редактора — это и фиксирует замок. */
export function monitorViewFromCamera(camera: Camera, rect: { width: number; height: number }): MonitorView {
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    x: round(-camera.x / camera.zoom),
    y: round(-camera.y / camera.zoom),
    w: round(rect.width / camera.zoom),
    h: round(rect.height / camera.zoom),
  };
}

/** Масштаб монитора: ширина области — во всю ширину холста. */
export const monitorViewZoom = (view: MonitorView, rect: { width: number }): number =>
  clampZoom(rect.width / view.w);

/**
 * Пределы верхнего края видимой области при прокрутке — в пределах листа. Если сам
 * зафиксированный вид выходит за лист, его край тоже допустим: иначе вид, который выбрал
 * инженер, нельзя было бы даже показать.
 */
export function lockedTopRange(
  view: MonitorView,
  sheet: SheetSize,
  rect: { height: number },
  zoom: number,
): { min: number; max: number } {
  const visibleH = rect.height / zoom;
  return {
    min: Math.min(0, view.y),
    max: Math.max(view.y, sheet.h - visibleH),
  };
}

/** Камера монитора для зафиксированного вида; `top` — верхний край (по умолчанию вида). */
export function cameraForMonitorView(
  view: MonitorView,
  sheet: SheetSize,
  rect: { width: number; height: number },
  top: number = view.y,
): Camera {
  const zoom = monitorViewZoom(view, rect);
  const { min, max } = lockedTopRange(view, sheet, rect, zoom);
  const clampedTop = Math.min(max, Math.max(min, top));
  return { x: -view.x * zoom, y: -clampedTop * zoom, zoom };
}
