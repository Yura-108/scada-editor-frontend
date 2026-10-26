import { GRID } from "@/lib/utils";
import { GRID_MAJOR, FINE_GRID_MIN_ZOOM, MAJOR_GRID_MIN_ZOOM } from "@/lib/editor/gridPattern";

/**
 * Шаг сетки по зуму: паттерн живёт в мировых координатах и ужимается вместе со
 * сценой, поэтому на «весь лист» (A0 — это 0.056) мелкая клетка занимает около
 * пикселя и сетка превращается в сплошную заливку. null — сетки нет вовсе.
 */
export function gridStepForZoom(zoom: number): number | null {
  if (zoom >= FINE_GRID_MIN_ZOOM) return GRID;
  if (zoom >= MAJOR_GRID_MIN_ZOOM) return GRID_MAJOR;
  return null;
}
