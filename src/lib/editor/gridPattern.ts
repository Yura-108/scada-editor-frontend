import { GRID } from "@/lib/utils";

/** Создаёт GRID×GRID canvas-паттерн сетки (линии сверху и слева ячейки). */
export function createGridPattern(gridLine: string): HTMLCanvasElement {
  const cvs = document.createElement("canvas");
  cvs.width = GRID;
  cvs.height = GRID;
  const ctx = cvs.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = gridLine;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(GRID, 0);
    ctx.moveTo(0, 0); ctx.lineTo(0, GRID);
    ctx.stroke();
  }
  return cvs;
}
