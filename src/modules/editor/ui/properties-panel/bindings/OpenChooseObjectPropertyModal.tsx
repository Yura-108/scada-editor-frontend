"use client";

import React, {useMemo, useState} from "react";
import {ChevronDown, ChevronRight, Puzzle} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import Modal from "@/shared/ui/dialog/Modal";
import {useEditorStore} from "../../../model/editorStore";
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

  // Показываем компоненты сцены И любой элемент, у которого есть сохранённые
  // (с числовым id) свойства — свойство можно завести на любом элементе, не
  // обязательно на «компоненте». Строки таблиц (type==="table") не считаются —
  // это привязки к рядам сетки, отдельная фича, здесь не выбираемая.
  const components = useMemo(
    () => elements.filter(el =>
      isComponentEl(el) || (el.type !== "table" && (el.properties?.some(p => typeof p.id === "number") ?? false))
    ),
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
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      bodyClassName="flex flex-col"
      title="Свойства объектов схемы"
      description={<>
        Выберите свойство компонента, чтобы сослаться на него в коде привязки. В рантайме его
        значение приходит из записей серверных скриптов (<code>properties[]</code>).
      </>}
      footer={<>
        <Button onClick={onClose}>Закрыть</Button>
      </>}
    >
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
        {components.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            На сцене нет элементов со свойствами. Добавьте элементу свойство на вкладке
            «Свойства» (оно уходит на сервер сразу же), затем возвращайтесь сюда.
          </div>
        ) : (
          components.map(c => {
            // Строки таблиц сюда не попадают вовсе (см. фильтр components выше,
            // el.type !== "table"), так что props — это просто все свойства элемента.
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
                        // Отдельная константа, а не флаг: у черновика (свойство из
                        // шаблона, ещё не заведённое на сервере) id нет вовсе.
                        const savedId = typeof p.id === "number" ? p.id : null;
                        const saved = savedId !== null;
                        const already = savedId !== null && pickedIds?.has(savedId);
                        return (
                          <button
                            key={`${p.id}-${p.name}`}
                            type="button"
                            disabled={!saved}
                            title={saved ? undefined : "Свойство ещё не сохранено — сначала сохраните схему"}
                            onClick={() =>
                              saved &&
                              savedId !== null &&
                              onPick({
                                componentKey: c.key,
                                componentId: c.id,
                                componentLabel: componentLabel(c),
                                propertyId: savedId,
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
    </Modal>
  );
}
