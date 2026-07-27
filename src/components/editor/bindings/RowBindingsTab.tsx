"use client";

import React from "react";
import {Pencil, Trash2, Waypoints} from "lucide-react";
import {DiagramElement, ComponentPropertyDto, TableCellData} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";
import {getCellData} from "@/lib/editor/tableCells";
import openRowTagBindingModal from "./RowTagBindingModal";

interface RowBindingsTabProps {
  element: DiagramElement;
  rows: number;
  cellsMap: Record<string, TableCellData> | undefined;
}

/**
 * Вкладка «Строки» панели свойств таблицы: привязка каждой строки к тегу —
 * отдельный bulk-контракт (property_type:"TAG"), не связанный с обычными
 * свойствами элемента (вкладка «Свойства») или JS-биндингами (вкладка «Привязки»).
 * Чисто клиентский черновик — round-trip только через сохранение сцены
 * (buildComponentNode/transformElements), без отдельного REST-запроса на строку.
 */
export const RowBindingsTab: React.FC<RowBindingsTabProps> = ({element, rows, cellsMap}) => {
  const updateElement = useEditorStore(s => s.updateElement);
  const rowBindings = element.type === "table" ? (element.rowBindings ?? []) : [];

  const setBinding = (row: number, binding: ComponentPropertyDto) => {
    const next = [...rowBindings];
    next[row] = binding;
    updateElement(element.key, {rowBindings: next});
  };

  const removeBinding = (row: number) => {
    const next = [...rowBindings];
    next[row] = undefined as unknown as ComponentPropertyDto;
    updateElement(element.key, {rowBindings: next});
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Строки</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Привязка каждой строки таблицы к тегу — отправляется бэкенду как <code>properties</code>{" "}
        при сохранении сцены (по одной записи на строку, порядок = порядок строк).
      </p>

      <div className="space-y-2">
        {Array.from({length: Math.max(0, rows)}, (_, row) => {
          const binding = rowBindings[row];
          const hint = getCellData(cellsMap, row, 0)?.value;
          return (
            <div
              key={row}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white/60 dark:bg-neutral-900/60 border-gray-200 dark:border-neutral-700"
            >
              <span className="text-xs text-gray-400 dark:text-gray-500 w-6 shrink-0 text-right">
                {row + 1}
              </span>

              {binding ? (
                <button
                  className="flex-1 min-w-0 text-left text-sm text-gray-800 dark:text-gray-200 truncate hover:underline flex items-center gap-1.5"
                  title="Редактировать привязку"
                  onClick={() => openRowTagBindingModal({row, binding, onConfirm: (b) => setBinding(row, b)})}
                >
                  <Waypoints size={13} className="text-emerald-500 shrink-0" />
                  <span className="truncate">
                    {binding.name} · {binding.tag_id} · {binding.value_type}
                  </span>
                </button>
              ) : (
                <button
                  className="flex-1 min-w-0 text-left text-sm text-gray-400 dark:text-gray-600 italic truncate hover:text-gray-600 dark:hover:text-gray-400"
                  onClick={() => openRowTagBindingModal({row, onConfirm: (b) => setBinding(row, b)})}
                >
                  {hint ? `(${hint}) без привязки` : "Без привязки"}
                </button>
              )}

              {binding && (
                <>
                  <button
                    className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                    title="Редактировать"
                    onClick={() => openRowTagBindingModal({row, binding, onConfirm: (b) => setBinding(row, b)})}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                    title="Отвязать"
                    onClick={() => removeBinding(row)}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
