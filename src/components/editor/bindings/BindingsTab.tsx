"use client";

import React from "react";
import {Pencil, Plus, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {DiagramElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";
import {openBindingEditorModal} from "./OpenBindingEditorModal";

interface BindingsTabProps {
  element: DiagramElement;
  addButtonClasses: string;
}

/**
 * Вкладка «Привязки» панели свойств: список JS-биндингов элемента
 * (исполняются на клиенте в режиме монитора), тумблер включения,
 * редактирование/удаление, создание нового через модалку.
 */
export const BindingsTab: React.FC<BindingsTabProps> = ({element, addButtonClasses}) => {
  const updateBinding = useEditorStore(s => s.updateBinding);
  const removeBinding = useEditorStore(s => s.removeBinding);

  const bindings = element.bindings ?? [];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Привязки к тегам
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        JavaScript-скрипты, исполняемые в режиме монитора при изменении значений тегов
        (переключают состояние или меняют свойства элемента).
      </p>

      {bindings.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 italic py-3">
          Нет привязок
        </div>
      ) : (
        <div className="space-y-2">
          {bindings.map(binding => (
            <div
              key={binding.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border",
                "bg-white/60 dark:bg-neutral-900/60 border-gray-200 dark:border-neutral-700",
                !binding.enabled && "opacity-60",
              )}
            >
              {/* Тумблер включения */}
              <input
                type="checkbox"
                checked={binding.enabled}
                title={binding.enabled ? "Привязка активна" : "Привязка выключена"}
                onChange={e => updateBinding(element.key, binding.id, {enabled: e.target.checked})}
                className="w-4 h-4 rounded border-gray-300 dark:border-neutral-600 text-blue-500"
              />

              <button
                className="flex-1 text-left text-sm text-gray-800 dark:text-gray-200 truncate hover:underline"
                title="Редактировать привязку"
                onClick={() => openBindingEditorModal({element, binding})}
              >
                {binding.name || "Без названия"}
              </button>

              <button
                className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                title="Редактировать"
                onClick={() => openBindingEditorModal({element, binding})}
              >
                <Pencil size={14} />
              </button>
              <button
                className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                title="Удалить привязку"
                onClick={() => removeBinding(element.key, binding.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        className={addButtonClasses}
        onClick={() => openBindingEditorModal({element})}
      >
        <Plus size={18} />
        Добавить привязку
      </button>
    </div>
  );
};
