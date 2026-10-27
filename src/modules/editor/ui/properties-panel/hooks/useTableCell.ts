import {DiagramElement, TableCellData} from "@/types/editorElement.type";
import type {CellSourceField} from "@/types/binding.types";
import {createUuid} from "@/shared/lib/createUuid";
import {cellRuntimeKey, getCellData, mergeCellPatch, cellBindingAt, setTrackSize} from "@/core/scene";
import {useEditorStore} from "../../../model/editorStore";
import {getTableTracks} from "../lib/tableTracks";

/**
 * Таблица в панели: выбранная ячейка, её привязки и правка, размеры полос.
 * `values` — отображаемый вид элемента (`getRenderedElement`).
 */
export function useTableCell(element: DiagramElement, values: Record<string, unknown>) {
  const selectedTableCell = useEditorStore(s => s.selectedTableCell);
  const updateElementVisual = useEditorStore(s => s.updateElementVisual);
  const addBinding = useEditorStore(s => s.addBinding);
  const removeBinding = useEditorStore(s => s.removeBinding);

  // Сфокусированная ячейка таблицы (панель свойств показывает cell-блок только пока
  // фокус принадлежит ИМЕННО этому элементу — переживает переключение вкладок).
  const cellFocus = element.type === "table" && selectedTableCell?.elementKey === element.key
    ? selectedTableCell
    : null;
  const cellsMap = values.cells as Record<string, TableCellData> | undefined;
  const cellData = cellFocus ? getCellData(cellsMap, cellFocus.row, cellFocus.col) : undefined;
  const cellTargetKey = cellFocus ? cellRuntimeKey(cellFocus.row, cellFocus.col) : null;
  // Привязка ячейки к полю СВОЕГО свойства (новая модель, см. tableBindings.ts).
  const ownCellBinding = cellFocus ? cellBindingAt(element, cellFocus.row, cellFocus.col) : undefined;
  // Прежняя межкомпонентная привязка ячейки (direct + directTarget) — живёт своим путём.
  const cellBinding = cellTargetKey
    ? (element.bindings ?? []).find(b => b.direct && b.directTarget === cellTargetKey)
    : undefined;
  const cellBindingRef = cellBinding?.propertyRefs?.[0];

  /** Привязать ячейку к полю свойства (или переназначить). */
  const bindCell = (propertyName: string, field: CellSourceField) => {
    if (!cellFocus) return;
    if (ownCellBinding) removeBinding(element.key, ownCellBinding.id);
    addBinding(element.key, {
      v: 1,
      id: createUuid(),
      name: propertyName,
      enabled: true,
      code: "",
      cell: {row: cellFocus.row, col: cellFocus.col, propertyName, field},
    });
  };
  // Ячейку можно привязать, как только у элемента есть свойство: сохранённость больше
  // не требуется — свойство уезжает вместе со сценой.
  const canBindCell = (element.properties?.length ?? 0) > 0;

  const patchCell = (patch: Partial<TableCellData>) => {
    if (!cellFocus) return;
    updateElementVisual(element.key, {
      cells: mergeCellPatch(cellsMap, cellFocus.row, cellFocus.col, patch),
    });
  };

  const tableTracks = element.type !== "table" ? null : getTableTracks(values);

  /** Задать ширину столбца / высоту строки: разница снимается с соседней полосы. */
  const setTableTrack = (axis: "col" | "row", index: number, size: number) => {
    if (!tableTracks) return;
    updateElementVisual(element.key, axis === "col"
      ? {colWidths: setTrackSize(tableTracks.colWs, index, size)}
      : {rowHeights: setTrackSize(tableTracks.rowHs, index, size)});
  };

  return {
    cellFocus, cellData, cellTargetKey, ownCellBinding, cellBinding, cellBindingRef,
    bindCell, canBindCell, patchCell, tableTracks, setTableTrack,
  };
}

export type TableCellModel = ReturnType<typeof useTableCell>;
