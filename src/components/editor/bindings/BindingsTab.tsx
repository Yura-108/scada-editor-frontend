"use client";

import React, {useState} from "react";
import {Boxes, Pencil, Plus, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {DiagramElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";
import {collectTagScope, hasSavedProperty, uniqueVarName} from "@/lib/runtime/bindingScope";
import {createUuid} from "@/lib/createUuid";
import {openBindingEditorModal} from "./OpenBindingEditorModal";
import {ChooseObjectPropertyModal, type PickedProperty} from "./OpenChooseObjectPropertyModal";

interface BindingsTabProps {
  element: DiagramElement;
  addButtonClasses: string;
}

/** Визуальное свойство элемента, в которое пишет прямая привязка (значение gauge и т.п.). */
const DIRECT_TARGET = "value";

/**
 * Вкладка «Привязки» панели свойств: список JS-биндингов элемента
 * (исполняются на клиенте в режиме монитора), тумблер включения,
 * редактирование/удаление, создание нового.
 *
 * Два способа: «Привязать свойство» — прямая привязка «значение ← свойство»
 * без кода и имени (просто выбрать свойство); «Скрипт-привязка» — редактор
 * JavaScript для сложной логики (setState по порогу и т.п.).
 */
export const BindingsTab: React.FC<BindingsTabProps> = ({element, addButtonClasses}) => {
  const updateBinding = useEditorStore(s => s.updateBinding);
  const removeBinding = useEditorStore(s => s.removeBinding);
  const addBinding = useEditorStore(s => s.addBinding);

  const [pickerOpen, setPickerOpen] = useState(false);

  const bindings = element.bindings ?? [];
  const canSave = hasSavedProperty(element.properties);

  // Прямая привязка: значение элемента = значение выбранного свойства.
  const createDirectBinding = (picked: PickedProperty) => {
    setPickerOpen(false);
    const taken = new Set(collectTagScope(element.properties).names);
    const varName = uniqueVarName(picked.propertyName, taken);
    addBinding(element.key, {
      v: 1,
      id: createUuid(),
      name: picked.propertyName,
      enabled: true,
      direct: true,
      code: `setProp(${JSON.stringify(DIRECT_TARGET)}, ${varName}.V)`,
      propertyRefs: [
        {
          varName,
          propertyId: picked.propertyId,
          componentKey: picked.componentKey,
          componentId: picked.componentId,
          componentLabel: picked.componentLabel,
          propertyName: picked.propertyName,
          valueType: picked.valueType,
        },
      ],
    });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Привязки</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        В режиме монитора значение элемента может браться напрямую из свойства другого
        компонента, либо управляться JavaScript-скриптом (переключение состояния, смена
        визуальных свойств).
      </p>

      {!canSave && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          У элемента нет ни одного сохранённого свойства — новую привязку сохранить не получится
          (бэкенд требует её на конкретное свойство этого элемента). Сначала добавьте элементу
          свойство на вкладке «Свойства».
        </div>
      )}

      {bindings.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 italic py-3">Нет привязок</div>
      ) : (
        <div className="space-y-2">
          {bindings.map(binding => {
            const ref = binding.direct ? binding.propertyRefs?.[0] : undefined;
            return (
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

                {binding.direct && ref ? (
                  <div
                    className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 truncate flex items-center gap-1.5"
                    title={`Значение ← ${ref.componentLabel} · ${ref.propertyName}`}
                  >
                    <Boxes size={13} className="text-emerald-500 shrink-0" />
                    <span className="text-gray-500 dark:text-gray-400">значение ←</span>
                    <span className="truncate">
                      {ref.componentLabel} · {ref.propertyName}
                    </span>
                  </div>
                ) : (
                  <button
                    className="flex-1 min-w-0 text-left text-sm text-gray-800 dark:text-gray-200 truncate hover:underline"
                    title="Редактировать привязку"
                    onClick={() => openBindingEditorModal({element, binding})}
                  >
                    {binding.name || "Без названия"}
                  </button>
                )}

                {!binding.direct && (
                  <button
                    className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                    title="Редактировать"
                    onClick={() => openBindingEditorModal({element, binding})}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                  title="Удалить привязку"
                  onClick={() => removeBinding(element.key, binding.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button className={addButtonClasses} onClick={() => setPickerOpen(true)}>
        <Boxes size={18} />
        Привязать свойство
      </button>

      <button
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800/60 border border-dashed border-gray-300 dark:border-neutral-700 transition-colors"
        onClick={() => openBindingEditorModal({element})}
      >
        <Plus size={14} />
        Скрипт-привязка (JavaScript)
      </button>

      <ChooseObjectPropertyModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={createDirectBinding}
      />
    </div>
  );
};
