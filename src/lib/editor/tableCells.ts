import type { TableCellData } from "@/types/editorElement.type";

/** Ключ ячейки в LeafElement.cells: "${row}_${col}" (0-based). */
export const cellId = (row: number, col: number): string => `${row}_${col}`;

/** Ключ рендер-пропа / рантайм-оверрайда для live-значения ячейки: "cell_${row}_${col}". */
export const cellRuntimeKey = (row: number, col: number): string => `cell_${row}_${col}`;

export const getCellData = (
  cells: Record<string, TableCellData> | undefined,
  row: number,
  col: number,
): TableCellData => cells?.[cellId(row, col)] ?? {};

/** Точечный патч одной ячейки с сохранением остальных — cells пишется ЦЕЛИКОМ (shallow merge в сторе). */
export const mergeCellPatch = (
  cells: Record<string, TableCellData> | undefined,
  row: number,
  col: number,
  patch: Partial<TableCellData>,
): Record<string, TableCellData> => ({
  ...cells,
  [cellId(row, col)]: { ...(cells?.[cellId(row, col)] ?? {}), ...patch },
});
