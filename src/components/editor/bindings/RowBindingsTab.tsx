"use client";

import React, {useState} from "react";
import {toast} from "sonner";
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

const getErrorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/**
 * Вкладка «Строки» панели свойств таблицы: привязка каждой строки к тегу или
 * локальному параметру — записи внутри element.properties, номер строки в поле
 * position (см. src/lib/editor/rowBinding.ts), не связанные с обычными
 * свойствами или JS-биндингами (вкладка «Привязки»). Уходит на бэкенд тем же
 * REST-путём, что и обычные свойства (addTags/editProperty, см.
 * OpenChooseTagModal): сохранение сцены само по себе новые properties не
 * создаёт, бэкенд обрабатывает их только через /api/editor/tags(/:id).
 */
export const RowBindingsTab: React.FC<RowBindingsTabProps> = ({element, rows, cellsMap}) => {
  const addTags = useEditorStore(s => s.addTags);
  const editProperty = useEditorStore(s => s.editProperty);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const properties = element.type === "table" ? (element.properties ?? []) : [];
  const bindingForRow = (row: number) => properties.find(p => p.position === row);

  const setBinding = async (row: number, binding: ComponentPropertyDto) => {
    if (!element.id) {
      toast.error("Сначала сохраните схему — компонент ещё не сохранён на сервере");
      return;
    }

    const existing = bindingForRow(row);
    const payload = {
      name: binding.name,
      component_id: element.id,
      property_type: binding.property_type,
      tag_id: binding.tag_id,
      description: "",
      value_type: binding.value_type,
      default_value: binding.default_value ?? "",
      logging: false,
      onChange: "",
      access_level: 0,
      OnCanChange: "",
      position: row,
    };

    setSavingRow(row);
    try {
      if (existing?.id) {
        await editProperty(existing.id, payload);
      } else {
        await addTags(payload);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Не удалось сохранить привязку строки"));
    } finally {
      setSavingRow(null);
    }
  };

  // Пока нет бэкенд-эндпоинта на удаление свойства — снимаем привязку только
  // локально (как и для обычных свойств-тегов, для которых удаления тоже нет).
  const updateElement = useEditorStore(s => s.updateElement);
  const removeBinding = (row: number) => {
    updateElement(element.key, {
      properties: properties.filter(p => p.position !== row),
    });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Строки</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Привязка каждой строки таблицы к тегу или локальному параметру — сохраняется сразу
        (номер строки — в поле <code>position</code>).
      </p>

      <div className="space-y-2">
        {Array.from({length: Math.max(0, rows)}, (_, row) => {
          const binding = bindingForRow(row);
          // Колонка 0 зарезервирована под авто-номер строки (см. TableShapeElement),
          // подсказку для ещё не привязанной строки логичнее брать из колонки 1 (имя).
          const hint = getCellData(cellsMap, row, 1)?.value;
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
                  className="flex-1 min-w-0 text-left text-sm text-gray-800 dark:text-gray-200 truncate hover:underline flex items-center gap-1.5 disabled:opacity-50"
                  title="Редактировать привязку"
                  disabled={savingRow === row}
                  onClick={() => openRowTagBindingModal({row, binding, onConfirm: (b) => setBinding(row, b)})}
                >
                  <Waypoints size={13} className="text-emerald-500 shrink-0" />
                  <span className="truncate">
                    {savingRow === row
                      ? "Сохранение..."
                      : binding.tag_id
                        ? `${binding.name} · ${binding.tag_id} · ${binding.value_type}`
                        : `${binding.name} · локально · ${binding.value_type}`}
                  </span>
                </button>
              ) : (
                <button
                  className="flex-1 min-w-0 text-left text-sm text-gray-400 dark:text-gray-600 italic truncate hover:text-gray-600 dark:hover:text-gray-400 disabled:opacity-50"
                  disabled={savingRow === row}
                  onClick={() => openRowTagBindingModal({row, onConfirm: (b) => setBinding(row, b)})}
                >
                  {savingRow === row ? "Сохранение..." : hint ? `(${hint}) без привязки` : "Без привязки"}
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
