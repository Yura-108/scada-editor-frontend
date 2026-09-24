"use client";

import React from "react";
import {NumberInput} from "@/components/ui/NumberInput";
import type {OptionsWindowSettings} from "@/types/editorElement.type";
import {DEFAULT_OPTIONS_FONT_SIZE, OPTIONS_WINDOW_LIMITS, readOptionsWindow} from "@/lib/editor/optionsWindow";

interface Props {
  value: OptionsWindowSettings | undefined;
  /** undefined — вернуть окно к размеру и шрифту по умолчанию. */
  onChange: (value: OptionsWindowSettings | undefined) => void;
  inputClassName: string;
}

const FIELDS: {key: keyof OptionsWindowSettings; label: string; placeholder: string}[] = [
  {key: "width", label: "Ширина, px", placeholder: "авто"},
  {key: "height", label: "Высота, px", placeholder: "авто"},
  {key: "fontSize", label: "Шрифт, px", placeholder: String(DEFAULT_OPTIONS_FONT_SIZE)},
];

/**
 * Размер и шрифт окна «Опции», которое монитор открывает по ПКМ на этом компоненте.
 *
 * Пустое поле — значение по умолчанию. Ввод зажимается в пределы тем же
 * `readOptionsWindow`, что читает настройки при загрузке, поэтому в сцену не попадёт
 * значение, которое монитор потом не принял бы.
 */
export function OptionsWindowSettingsBlock({value, onChange, inputClassName}: Props) {
  const commit = (key: keyof OptionsWindowSettings, v: number) =>
    onChange(readOptionsWindow({...value, [key]: v}));

  return (
    <div className="pt-3 space-y-3">
      <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700" />
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Окно «Опции» в мониторе
      </h4>
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map(f => (
          <div key={f.key} className="space-y-1.5">
            <label
              htmlFor={`options-window-${f.key}`}
              className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight"
            >
              {f.label}
            </label>
            <NumberInput
              id={`options-window-${f.key}`}
              className={inputClassName}
              value={value?.[f.key]}
              min={OPTIONS_WINDOW_LIMITS[f.key].min}
              max={OPTIONS_WINDOW_LIMITS[f.key].max}
              step={f.key === "fontSize" ? 1 : 10}
              placeholder={f.placeholder}
              onCommit={(v) => commit(f.key, v)}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Пустое поле — по умолчанию. На маленьком экране окно ужмётся до его размера.
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
    </div>
  );
}
