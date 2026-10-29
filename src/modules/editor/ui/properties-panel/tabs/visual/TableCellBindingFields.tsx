"use client";

import {Boxes, Trash2} from "lucide-react";
import {DiagramElement} from "@/types/editorElement.type";
import type {CellSourceField} from "@/types/binding.types";
import {TextInput} from "@/shared/ui/field/TextInput";
import {cellSourceFieldsFor} from "@/core/scene";
import {useEditorStore} from "../../../../model/editorStore";
import type {TableCellModel} from "../../hooks/useTableCell";
import {baseInputClasses} from "../../panelClasses";
import {historyEditing} from "../../../../model/historyGroup";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";
import {Select} from "@/shared/ui/field/Select";

/** Чем заполнена ячейка: полем свойства таблицы, свободным текстом или прежней привязкой. */
export function TableCellBindingFields({element, cell}: {element: DiagramElement; cell: TableCellModel}) {
  const removeBinding = useEditorStore(s => s.removeBinding);
  const {ownCellBinding, bindCell, cellData, patchCell, cellBinding, cellBindingRef} = cell;

  return (
    <>
      {/* Привязка ячейки к полю свойства таблицы. Свойства заводятся на
          вкладке «Свойства» — они принадлежат таблице целиком, а здесь
          указывается только, что из них показать в этой ячейке. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className={fieldLabelSmClass}>
            Свойство
          </label>
          <Select
            size="sm"
            value={ownCellBinding?.cell?.propertyName ?? ""}
            onValueChange={(name) => {
              if (!name) {
                if (ownCellBinding) removeBinding(element.key, ownCellBinding.id);
                return;
              }
              bindCell(name, ownCellBinding?.cell?.field ?? "value");
            }}
            options={[
              {value: "", label: "— свободный текст —"},
              ...(element.properties ?? []).map(p => ({
                value: p.name,
                label: p.label?.trim() ? `${p.name} — ${p.label.trim()}` : p.name,
              })),
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <label className={fieldLabelSmClass}>
            Поле
          </label>
          <Select
            size="sm"
            value={ownCellBinding?.cell?.field ?? "value"}
            disabled={!ownCellBinding}
            onValueChange={(v) => {
              if (!ownCellBinding?.cell) return;
              bindCell(ownCellBinding.cell.propertyName, v as CellSourceField);
            }}
            options={cellSourceFieldsFor(ownCellBinding?.cell?.field)}
          />
        </div>
      </div>

      {!ownCellBinding && (
        <div className="space-y-1.5">
          <label className={fieldLabelSmClass}>
            Текст
          </label>
          {/* Как и остальные текстовые поля: коммит по blur/Enter —
              значение ячейки уходит в схему целиком, а не посимвольно. */}
          <TextInput {...historyEditing}
            className={baseInputClasses}
            value={cellData?.value ?? ""}
            onCommit={(v) => patchCell({value: v})}
          />
        </div>
      )}

      {(element.properties?.length ?? 0) === 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          У таблицы нет свойств — добавьте их на вкладке «Свойства», чтобы
          привязывать ячейки.
        </p>
      )}

      {cellBinding && cellBindingRef && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs">
          <Boxes size={13} className="text-emerald-500 shrink-0" />
          <span className="text-gray-500 dark:text-gray-400">значение ←</span>
          <span className="truncate flex-1">
            {cellBindingRef.componentLabel} · {cellBindingRef.propertyName}
          </span>
          <button
            onClick={() => removeBinding(element.key, cellBinding.id)}
            className="text-gray-500 hover:text-red-500 transition-colors"
            title="Отвязать"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </>
  );
}
