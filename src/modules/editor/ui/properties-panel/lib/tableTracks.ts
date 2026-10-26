import {headerHeight, resolveTracks} from "@/lib/editor/tableLayout";
import {getNumberValue} from "./getNumberValue";

export interface TableTracks {
  rows: number;
  cols: number;
  h: number;
  headerH: number;
  showHeader: boolean;
  colWs: number[];
  rowHs: number[];
}

/**
 * Размеры полос таблицы.
 *
 * Считаются тем же кодом, что и рендер: в элементе лежат ВЕСА, а показывать и
 * редактировать надо фактические единицы сцены (см. src/lib/editor/tableLayout.ts).
 */
export function getTableTracks(values: Record<string, unknown>): TableTracks {
  const w = getNumberValue(values.w, 300);
  const h = getNumberValue(values.h, 160);
  const rows = Math.max(1, Math.round(getNumberValue(values.rows, 4)));
  const cols = Math.max(1, Math.round(getNumberValue(values.cols, 3)));
  const showHeader = values.showHeader !== false;
  const fontSize = getNumberValue(values.fontSize, 12);
  const headerH = headerHeight(showHeader, fontSize, values.headerH);
  return {
    rows, cols, h, headerH, showHeader,
    colWs: resolveTracks(values.colWidths, cols, w),
    rowHs: resolveTracks(values.rowHeights, rows, h - headerH),
  };
}
