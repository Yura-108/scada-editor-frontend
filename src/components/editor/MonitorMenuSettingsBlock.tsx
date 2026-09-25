"use client";

import React from "react";
import {NumberInput} from "@/components/ui/NumberInput";
import type {DiagramElement, MonitorMenuSettings} from "@/types/editorElement.type";
import {MONITOR_MENU_DEFAULTS, MONITOR_MENU_LIMITS, readMonitorMenu} from "@/lib/editor/monitorMenu";
import {monitorActions, tagProperties} from "@/components/editor/canvas/buildMonitorMenu";
import {ContextMenuPanel} from "@/components/editor/canvas/CanvasContextMenu";
import type {CanvasMenuItem} from "@/components/editor/canvas/types";

interface Props {
  element: DiagramElement;
  /** undefined — вернуть меню к виду по умолчанию. */
  onChange: (value: MonitorMenuSettings | undefined) => void;
  inputClassName: string;
}

const FIELDS: {key: keyof MonitorMenuSettings; label: string; placeholder: string; step: number}[] = [
  {key: "width", label: "Ширина, px", placeholder: "авто", step: 10},
  {key: "fontSize", label: "Шрифт, px", placeholder: String(MONITOR_MENU_DEFAULTS.fontSize), step: 1},
  {key: "itemHeight", label: "Высота пункта, px", placeholder: String(MONITOR_MENU_DEFAULTS.itemHeight), step: 2},
];

/**
 * Вид контекстного меню, которое монитор открывает по ПКМ на этом компоненте: «Опции»
 * (есть свойства-теги) и действия, отмеченные «Добавить действие в монитор?».
 *
 * Пустое поле — значение по умолчанию. Ввод зажимается тем же `readMonitorMenu`, что
 * читает настройки при загрузке, — в сцену не попадёт то, что монитор потом не принял бы.
 * Превью собрано из тех же пунктов, что увидит оператор, и той же плашкой.
 */
export function MonitorMenuSettingsBlock({element, onChange, inputClassName}: Props) {
  const value = element.monitorMenu;
  const commit = (key: keyof MonitorMenuSettings, v: number) =>
    onChange(readMonitorMenu({...value, [key]: v}));

  const previewItems: CanvasMenuItem[] = [
    ...(tagProperties(element).length ? [{label: "Опции"}] : []),
    ...monitorActions(element).map(s => ({label: s.name})),
  ];

  return (
    <div className="pt-3 space-y-3">
      <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700" />
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Меню в мониторе (ПКМ)
      </h4>
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map(f => (
          <div key={f.key} className="space-y-1.5">
            <label
              htmlFor={`monitor-menu-${f.key}`}
              className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight"
            >
              {f.label}
            </label>
            <NumberInput
              id={`monitor-menu-${f.key}`}
              className={inputClassName}
              value={value?.[f.key]}
              min={MONITOR_MENU_LIMITS[f.key].min}
              max={MONITOR_MENU_LIMITS[f.key].max}
              step={f.step}
              placeholder={f.placeholder}
              onCommit={(v) => commit(f.key, v)}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Пустое поле — по умолчанию. Длинные подписи при заданной ширине переносятся.
        </span>
        {value && (
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            onClick={() => onChange(undefined)}
          >
            По умолчанию
          </button>
        )}
      </div>
      {previewItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-gray-500 dark:text-gray-400">Так меню увидит оператор:</div>
          {/* Превью шире панели не бывает: иначе широкое меню растянуло бы её. */}
          <div className="overflow-x-auto">
            <ContextMenuPanel
              items={previewItems}
              settings={readMonitorMenu(value)}
              interactive={false}
              style={{width: value?.width ? undefined : "max-content"}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
