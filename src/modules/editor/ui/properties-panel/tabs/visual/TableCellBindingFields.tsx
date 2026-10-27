"use client";

import {Boxes, Trash2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {DiagramElement} from "@/types/editorElement.type";
import type {CellSourceField} from "@/types/binding.types";
import {TextInput} from "@/components/ui/TextInput";
import {cellSourceFieldsFor} from "@/core/scene";
import {useEditorStore} from "../../../../model/editorStore";
import type {TableCellModel} from "../../hooks/useTableCell";
import {propertyKey} from "../../lib/propertyOrder";
import {baseInputClasses} from "../../panelClasses";

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
          <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
            Свойство
          </label>
          <select
            className={cn(baseInputClasses, "appearance-none pr-8")}
            value={ownCellBinding?.cell?.propertyName ?? ""}
            onChange={(e) => {
              const name = e.target.value;
              if (!name) {
                if (ownCellBinding) removeBinding(element.key, ownCellBinding.id);
                return;
              }
              bindCell(name, ownCellBinding?.cell?.field ?? "value");
            }}
          >
            <option value="">— свободный текст —</option>
            {(element.properties ?? []).map(p => (
              <option key={propertyKey(p)} value={p.name}>
                {p.label?.trim() ? `${p.name} — ${p.label.trim()}` : p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
            Поле
          </label>
          <select
            className={cn(baseInputClasses, "appearance-none pr-8")}
            value={ownCellBinding?.cell?.field ?? "value"}
            disabled={!ownCellBinding}
            onChange={(e) => {
              if (!ownCellBinding?.cell) return;
              bindCell(ownCellBinding.cell.propertyName, e.target.value as CellSourceField);
            }}
          >
            {cellSourceFieldsFor(ownCellBinding?.cell?.field).map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {!ownCellBinding && (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
            Текст
          </label>
          {/* Как и остальные текстовые поля: коммит по blur/Enter —
              значение ячейки уходит в схему целиком, а не посимвольно. */}
          <TextInput
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
