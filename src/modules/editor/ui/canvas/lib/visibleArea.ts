/**
 * Видимая часть холста — без того, что лежит поверх него.
 *
 * Холст редактора занимает всю ширину рабочей области, боковые панели и панель инструментов
 * висят над ним (так панель сворачивается анимацией, а Stage не пересоздаётся на каждый пиксель
 * перетаскивания края). Поэтому «вписать» по всему `canvasRect` уводило края схемы под панели,
 * а верх — под инструменты (#10 п. 2). Здесь считается прямоугольник, который действительно
 * видно: элементы поверх холста помечены `data-canvas-overlay="left|right|top"`.
 *
 * Координаты — в системе холста (0,0 — его левый верхний угол). В мониторе панелей нет, и
 * область совпадает с холстом.
 */
export interface VisibleArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Меньше этого видимой области не бывает: при узком окне лучше залезть под панель, чем вписать в щель. */
const MIN_SIZE = 200;

export function visibleCanvasArea(canvasRect: {width: number; height: number}): VisibleArea {
  const full = {x: 0, y: 0, width: canvasRect.width, height: canvasRect.height};
  if (typeof document === "undefined") return full;
  const root = document.querySelector<HTMLElement>("[data-canvas-root]");
  if (!root) return full;
  const c = root.getBoundingClientRect();

  let left = 0, right = 0, top = 0;
  document.querySelectorAll<HTMLElement>("[data-canvas-overlay]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    // Свёрнутая панель уехала за край (translate) — она уже вне холста и ничего не закрывает.
    if (r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom) return;
    switch (el.dataset.canvasOverlay) {
      case "left": left = Math.max(left, r.right - c.left); break;
      case "right": right = Math.max(right, c.right - r.left); break;
      case "top": top = Math.max(top, r.bottom - c.top); break;
    }
  });

  const width = canvasRect.width - left - right;
  const height = canvasRect.height - top;
  if (width < MIN_SIZE || height < MIN_SIZE) return full;
  return {x: left, y: top, width, height};
}
