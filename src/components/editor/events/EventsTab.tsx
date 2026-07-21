"use client";

import React from "react";
import {MousePointerClick, Pencil, Plus, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {DiagramElement} from "@/types/editorElement.type";
import {ElementEventName, ElementEvents} from "@/types/binding.types";
import {useEditorStore} from "@/store/useEditorStore";
import {openEventScriptModal} from "./OpenEventScriptModal";

interface EventsTabProps {
  element: DiagramElement;
}

const EVENTS: Array<{name: ElementEventName; label: string; hint: string}> = [
  {name: "onClick", label: "onClick", hint: "Клик по элементу"},
  {name: "onDoubleClick", label: "onDoubleClick", hint: "Двойной клик по элементу"},
];

/**
 * Вкладка «События»: JS-обработчики onClick/onDoubleClick, исполняемые на клиенте
 * в режиме монитора. Например — изменение значения свойства объекта
 * (`setProperty("Test", Test.V + 1)`), на которое реагируют привязки других элементов.
 */
export const EventsTab: React.FC<EventsTabProps> = ({element}) => {
  const updateElement = useEditorStore(s => s.updateElement);

  const setHandlerEnabled = (name: ElementEventName, enabled: boolean) => {
    const current = element.events?.[name];
    if (!current) return;
    const nextEvents: ElementEvents = {...(element.events ?? {}), [name]: {...current, enabled}};
    updateElement(element.key, {events: nextEvents});
  };

  const removeHandler = (name: ElementEventName) => {
    const nextEvents: ElementEvents = {...(element.events ?? {})};
    delete nextEvents[name];
    updateElement(element.key, {events: nextEvents});
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">События</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        JavaScript-обработчики, исполняемые в режиме монитора при клике по элементу. Могут менять
        значение свойства объекта (<code>setProperty</code>) или визуал/состояние самого элемента.
      </p>

      <div className="space-y-2">
        {EVENTS.map(({name, label, hint}) => {
          const handler = element.events?.[name];
          return (
            <div
              key={name}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                "bg-white/60 dark:bg-neutral-900/60 border-gray-200 dark:border-neutral-700",
              )}
            >
              <div className="flex items-center gap-2">
                <MousePointerClick size={15} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{hint}</div>
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                  {handler ? (
                    <>
                      <label
                        className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mr-1"
                        title={handler.enabled === false ? "Обработчик выключен" : "Обработчик активен"}
                      >
                        <input
                          type="checkbox"
                          checked={handler.enabled !== false}
                          onChange={e => setHandlerEnabled(name, e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-neutral-600 text-blue-500"
                        />
                        вкл
                      </label>
                      <button
                        className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                        title="Редактировать скрипт"
                        onClick={() => openEventScriptModal({element, event: name})}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                        title="Удалить обработчик"
                        onClick={() => removeHandler(name)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      onClick={() => openEventScriptModal({element, event: name})}
                    >
                      <Plus size={13} />
                      Добавить
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Обработчики срабатывают только в режиме «Монитор» — в редакторе клики выделяют элемент.
      </p>
    </div>
  );
};
