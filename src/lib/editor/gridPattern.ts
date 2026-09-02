import { GRID } from "@/lib/utils";

/** Крупный шаг сетки — 10 клеток. На малых зумах мелкий шаг сливается в поле. */
export const GRID_MAJOR = GRID * 10;

/**
 * Ниже какого зума мелкая сетка бесполезна: клетка меньше ~5 px на экране
 * превращается в сплошную заливку, а не в сетку.
 */
export const FINE_GRID_MIN_ZOOM = 5 / GRID;

/** Ниже какого зума не рисуем и крупную сетку (её клетка тоже становится меньше 5 px). */
export const MAJOR_GRID_MIN_ZOOM = 5 / GRID_MAJOR;

/**
 * Создаёт canvas-паттерн сетки с заданным шагом (линии сверху и слева ячейки).
 *
 * Паттерн живёт в мировых координатах и масштабируется вместе со сценой, поэтому
 * шаг выбирается по зуму снаружи: лист A0 — это 21520 единиц, и на зуме «весь
 * лист» мелкая клетка занимает около пикселя.
 */
export function createGridPattern(gridLine: string, step: number = GRID): HTMLCanvasElement {
  const cvs = document.createElement("canvas");
  cvs.width = step;
  cvs.height = step;
  const ctx = cvs.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = gridLine;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(step, 0);
    ctx.moveTo(0, 0); ctx.lineTo(0, step);
    ctx.stroke();
  }
  return cvs;
}
