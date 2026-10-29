"use client";

import {useState} from "react";
import {Boxes} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {GRID} from "@/core/scene";
import {DiagramElement} from "@/types/editorElement.type";
import {ColorField} from "@/shared/ui/field/ColorField";
import {NumberInput} from "@/shared/ui/field/NumberInput";
import {ChooseObjectPropertyModal} from "../../bindings/OpenChooseObjectPropertyModal";
import {collectTagScope} from "@/core/runtime";
import {buildDirectBinding} from "../../../../lib/directBinding";
import {useEditorStore} from "../../../../model/editorStore";
import type {TableCellModel} from "../../hooks/useTableCell";
import {baseAddButtonClasses, baseInputClasses} from "../../panelClasses";
import {TableCellBindingFields} from "./TableCellBindingFields";

interface TableCellSectionProps {
  element: DiagramElement;
  values: Record<string, unknown>;
  cell: TableCellModel;
}

/**
 * Ячейка таблицы: показывается только когда фокус (клик по ячейке на холсте)
 * принадлежит этому элементу. Табличные свойства ниже остаются видимы —
 * можно редактировать и таблицу целиком, и конкретную ячейку одновременно.
 */
export function TableCellSection({element, values, cell}: TableCellSectionProps) {
  const clearTableCellSelection = useEditorStore(s => s.clearTableCellSelection);
  const addBinding = useEditorStore(s => s.addBinding);
  const [cellPickerOpen, setCellPickerOpen] = useState(false);
  const {cellFocus, cellTargetKey, cellData, patchCell, tableTracks, setTableTrack, cellBinding, canBindCell} = cell;
  if (!cellFocus || !cellTargetKey) return null;

  return (
    <div className="space-y-3 rounded-xl border border-amber-400/40 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
          Ячейка: строка {cellFocus.row + 1}, столбец {cellFocus.col + 1}
        </h4>
        <button
          type="button"
          onClick={() => clearTableCellSelection()}
          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          title="Снять выделение ячейки"
          aria-label="Снять выделение ячейки"
        >
          <span aria-hidden>✕</span>
        </button>
      </div>

      <TableCellBindingFields element={element} cell={cell}/>

      <ColorField
        id="cell-bg"
        label="Цвет фона ячейки"
        value={cellData?.backgroundColor || "transparent"}
        onChange={(v) => patchCell({backgroundColor: v})}
        inputClassName={baseInputClasses}
      />
      <ColorField
        id="cell-text-color"
        label="Цвет текста ячейки"
        value={cellData?.textColor || (values.textColor as string) || "#000000"}
        onChange={(v) => patchCell({textColor: v})}
        inputClassName={baseInputClasses}
      />

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
          Выравнивание
        </label>
        <select
          className={cn(baseInputClasses, "appearance-none pr-8")}
          value={cellData?.align ?? "left"}
          onChange={(e) => patchCell({align: e.target.value as "left" | "center" | "right"})}
        >
          <option value="left">Слева</option>
          <option value="center">По центру</option>
          <option value="right">Справа</option>
        </select>
      </div>

      {/* Размер полос, которым принадлежит ячейка. Правится и мышью —
          границы столбцов/строк на холсте (TableResizeHandles). */}
      {tableTracks && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label
              htmlFor="cell-col-width"
              className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight"
            >
              Ширина столбца
            </label>
            <NumberInput
              id="cell-col-width"
              className={baseInputClasses}
              value={Math.round(tableTracks.colWs[cellFocus.col] ?? 0)}
              step={GRID}
              onCommit={(v) => setTableTrack("col", cellFocus.col, v)}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="cell-row-height"
              className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight"
            >
              Высота строки
            </label>
            <NumberInput
              id="cell-row-height"
              className={baseInputClasses}
              value={Math.round(tableTracks.rowHs[cellFocus.row] ?? 0)}
              step={GRID}
              onCommit={(v) => setTableTrack("row", cellFocus.row, v)}
            />
          </div>
        </div>
      )}

      {!cellBinding && (
        <button
          className={canBindCell
            ? baseAddButtonClasses
            : "flex items-center gap-2 py-2 text-sm text-gray-400 dark:text-gray-600 cursor-not-allowed"}
          disabled={!canBindCell}
          title={canBindCell ? undefined : "Сначала сохраните схему и добавьте элементу свойство на вкладке «Свойства» — привязка требует сохранённого свойства."}
          onClick={() => canBindCell && setCellPickerOpen(true)}
        >
          <Boxes size={16} />
          Привязать к тегу
        </button>
      )}

      <ChooseObjectPropertyModal
        open={cellPickerOpen}
        onClose={() => setCellPickerOpen(false)}
        onPick={(picked) => {
          setCellPickerOpen(false);
          if (!cellTargetKey) return;
          const taken = new Set(collectTagScope(element.properties).names);
          addBinding(element.key, buildDirectBinding(cellTargetKey, picked, taken));
        }}
      />
    </div>
  );
}
