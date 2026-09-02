"use client";

import React, {useMemo} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {NumberInput} from "@/components/ui/NumberInput";
import {resolveSheet, SHEET_PRESETS, SHEET_MIN, SHEET_MAX, isSameSheet} from "@/lib/editor/sheet";
import {cn} from "@/lib/utils";

const inputClasses = cn(
  "w-full bg-white/80 dark:bg-neutral-900/80 border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm",
  "text-gray-900 dark:text-neutral-100",
  "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
  "transition-all duration-200 hover:border-gray-400 dark:hover:border-neutral-600",
);

/**
 * Свойства самой сцены — показываются, когда ничего не выделено.
 *
 * Пока это только размер листа. Лист — подсказка, а не запрет: за его край можно
 * выйти, схемы шире листа продолжают работать.
 */
export function ScenePropertiesPanel() {
  const elements = useEditorStore(s => s.elements);
  const setSheet = useEditorStore(s => s.setSheet);

  const sheet = useMemo(() => resolveSheet(elements), [elements]);

  // Пресет считаем совпавшим только по обеим сторонам — иначе «A3» подсветится
  // на любом листе шириной 11900.
  const preset = SHEET_PRESETS.find(p => isSameSheet(p, sheet));

  const label = (text: string, htmlFor: string) => (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-600 dark:text-neutral-400">
      {text}
    </label>
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          Лист
        </h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
          Размер сцены в единицах холста. Рамка листа — подсказка: за её край можно выйти.
        </p>
      </div>

      <div className="space-y-1.5">
        {label("Формат", "sheet-preset")}
        <select
          id="sheet-preset"
          className={inputClasses}
          value={preset?.label ?? ""}
          onChange={(e) => {
            const next = SHEET_PRESETS.find(p => p.label === e.target.value);
            if (next) setSheet(next.w, next.h);
          }}
        >
          {/* Импортированная сцена берёт размер из файла и номиналу ISO не обязана
              соответствовать — для неё показываем «свой». */}
          {!preset && <option value="">Свой размер</option>}
          {SHEET_PRESETS.map(p => (
            <option key={p.label} value={p.label}>
              {p.label} — {p.w} × {p.h}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          {label("Ширина", "sheet-w")}
          <NumberInput
            id="sheet-w"
            className={inputClasses}
            value={sheet.w}
            min={SHEET_MIN}
            max={SHEET_MAX}
            step={20}
            onCommit={(v) => setSheet(v, sheet.h)}
          />
        </div>
        <div className="space-y-1.5">
          {label("Высота", "sheet-h")}
          <NumberInput
            id="sheet-h"
            className={inputClasses}
            value={sheet.h}
            min={SHEET_MIN}
            max={SHEET_MAX}
            step={20}
            onCommit={(v) => setSheet(sheet.w, v)}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <p className="text-xs text-neutral-500 dark:text-neutral-500">
          Выберите элемент на схеме, чтобы изменить его свойства.
        </p>
      </div>
    </div>
  );
}
