"use client";

import React, {useMemo, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {ChevronDown, ChevronRight, Puzzle} from "lucide-react";
import {cn} from "@/lib/utils";
import {useEditorStore} from "@/store/useEditorStore";
import {elementRegistry} from "@/constants/propertiesPanel";
import {DiagramElement, ElementType} from "@/types/editorElement.type";

/** Результат выбора свойства другого компонента для ссылки в биндинге. */
export interface PickedProperty {
  componentKey: string;
  componentId: number | null;
  componentLabel: string;
  propertyId: number;
  propertyName: string;
  valueType?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedProperty) => void;
  /** propertyId-ы уже добавленных ссылок — помечаются как выбранные. */
  pickedIds?: ReadonlySet<number>;
}

// Классификатор компонента — как в AddComponentModal (модуль-приватный в сторе).
const isComponentEl = (el: DiagramElement) =>
  el.isComponent === true || (elementRegistry[el.type as ElementType]?.complex ?? false);

const componentLabel = (el: DiagramElement) =>
  el.label || `${isComponentEl(el) ? "Компонент" : "Элемент"} ${el.key.slice(0, 8)}`;

/**
 * Модалка выбора свойства другого (или своего) компонента сцены для привязки.
 * Дерево: компоненты сцены → их свойства. Выбрать можно только сохранённое на
 * сервере свойство (числовой id — ключ маршрутизации properties[] в рантайме).
 */
export function ChooseObjectPropertyModal({open, onClose, onPick, pickedIds}: Props) {
  const elements = useEditorStore(s => s.elements);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Показываем компоненты сцены И любой элемент, у которого есть свойства
  // (свойство можно завести на любом элементе — не обязательно на «компоненте»).
  const components = useMemo(
    () => elements.filter(el => isComponentEl(el) || (el.properties?.length ?? 0) > 0),
    [elements],
  );

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Dialog.Root open={open} onOpenChange={o => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2",
            "w-[95vw] max-w-lg max-h-[85vh] flex flex-col overflow-hidden rounded-2xl",
            "bg-white dark:bg-[#0f0f1a] text-gray-900 dark:text-white",
            "border border-gray-200 dark:border-gray-800/70 shadow-2xl shadow-black/50 p-6",
            "focus:outline-none",
          )}
        >
          <Dialog.Title className="text-lg font-semibold mb-1">Свойства объектов сцены</Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Выберите свойство компонента, чтобы сослаться на него в коде привязки. В рантайме его
            значение приходит из записей серверных скриптов (<code>properties[]</code>).
          </Dialog.Description>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
            {components.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                На сцене нет элементов со свойствами. Добавьте элементу свойство на вкладке
                «Свойства» (оно уходит на сервер сразу же), затем возвращайтесь сюда.
              </div>
            ) : (
              components.map(c => {
                const props = c.properties ?? [];
                const isOpen = expanded.has(c.key);
                return (
                  <div
                    key={c.key}
                    className="rounded-lg border border-gray-200 dark:border-gray-800/70 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Puzzle size={14} className="text-indigo-400 shrink-0" />
                      <span className="font-medium text-sm truncate">{componentLabel(c)}</span>
                      <span className="ml-auto text-xs text-gray-500 shrink-0">
                        {props.length} св-в
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-2 pb-2 space-y-1">
                        {props.length === 0 ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400 pl-6 py-1">
                            У компонента нет свойств.
                          </div>
                        ) : (
                          props.map(p => {
                            const saved = typeof p.id === "number";
                            const already = saved && pickedIds?.has(p.id);
                            return (
                              <button
                                key={`${p.id}-${p.name}`}
                                type="button"
                                disabled={!saved}
                                title={saved ? undefined : "Свойство ещё не сохранено — сначала сохраните сцену"}
                                onClick={() =>
                                  saved &&
                                  onPick({
                                    componentKey: c.key,
                                    componentId: c.id,
                                    componentLabel: componentLabel(c),
                                    propertyId: p.id,
                                    propertyName: p.name,
                                    valueType: p.value_type,
                                  })
                                }
                                className={cn(
                                  "w-full flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-md text-left text-sm transition-colors",
                                  saved
                                    ? "hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                                    : "opacity-50 cursor-not-allowed",
                                  already && "bg-indigo-50 dark:bg-indigo-950/40",
                                )}
                              >
                                <span className="font-medium truncate">{p.name || "(без имени)"}</span>
                                {p.value_type && (
                                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
                                    {p.value_type}
                                  </span>
                                )}
                                <span className="ml-auto text-[10px] text-gray-500 shrink-0">
                                  {p.property_type}
                                </span>
                                {already && (
                                  <span className="text-[10px] text-indigo-500 shrink-0">добавлено</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 transition-colors text-gray-800 dark:text-gray-300"
            >
              Закрыть
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
