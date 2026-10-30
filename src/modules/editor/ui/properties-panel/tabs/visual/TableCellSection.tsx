"use client";

import {useState} from "react";
import {Boxes} from "lucide-react";
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
import {historyEditing} from "../../../../model/historyGroup";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";
import {Select} from "@/shared/ui/field/Select";

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
    <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-warning uppercase tracking-wider">
          Ячейка: строка {cellFocus.row + 1}, столбец {cellFocus.col + 1}
        </h4>
        <button
          type="button"
          onClick={() => clearTableCellSelection()}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Снять выделение ячейки"
          aria-label="Снять выделение ячейки"
        >
          <span aria-hidden>✕</span>
        </button>
      </div>

      <TableCellBindingFields element={element} cell={cell}/>

      <ColorField {...historyEditing}
        id="cell-bg"
        label="Цвет фона ячейки"
        value={cellData?.backgroundColor || "transparent"}
        onChange={(v) => patchCell({backgroundColor: v})}
        inputClassName={baseInputClasses}
      />
      <ColorField {...historyEditing}
        id="cell-text-color"
        label="Цвет текста ячейки"
        value={cellData?.textColor || (values.textColor as string) || "#000000"}
        onChange={(v) => patchCell({textColor: v})}
        inputClassName={baseInputClasses}
      />

      <div className="space-y-1.5">
        <label className={fieldLabelSmClass}>
          Выравнивание
        </label>
        <Select
          size="sm"
          value={cellData?.align ?? "left"}
          onValueChange={(v) => patchCell({align: v as "left" | "center" | "right"})}
          options={[
            {value: "left", label: "Слева"},
            {value: "center", label: "По центру"},
            {value: "right", label: "Справа"},
          ]}
        />
      </div>

      {/* Размер полос, которым принадлежит ячейка. Правится и мышью —
          границы столбцов/строк на холсте (TableResizeHandles). */}
      {tableTracks && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label
              htmlFor="cell-col-width"
              className={fieldLabelSmClass}
            >
              Ширина столбца
            </label>
            <NumberInput {...historyEditing}
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
              className={fieldLabelSmClass}
            >
              Высота строки
            </label>
            <NumberInput {...historyEditing}
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
