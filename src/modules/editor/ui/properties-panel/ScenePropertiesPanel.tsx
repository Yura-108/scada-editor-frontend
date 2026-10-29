"use client";

import React, {useMemo} from "react";
import {useEditorStore} from "../../model/editorStore";
import {NumberInput} from "@/shared/ui/field/NumberInput";
import {resolveSheet, SHEET_PRESETS, SHEET_MIN, SHEET_MAX, isSameSheet} from "@/core/scene";
import {historyEditing} from "../../model/historyGroup";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";
import {baseInputClasses} from "./panelClasses";
import {Select} from "@/shared/ui/field/Select";

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
    <label htmlFor={htmlFor} className={fieldLabelSmClass}>
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
        {/* Импортированная сцена берёт размер из файла и номиналу ISO не обязана
            соответствовать — для неё показываем «свой». */}
        <Select
          id="sheet-preset"
          size="sm"
          value={preset?.label ?? ""}
          onValueChange={(v) => {
            const next = SHEET_PRESETS.find(p => p.label === v);
            if (next) setSheet(next.w, next.h);
          }}
          options={[
            ...(!preset ? [{value: "", label: "Свой размер"}] : []),
            ...SHEET_PRESETS.map(p => ({value: p.label, label: `${p.label} — ${p.w} × ${p.h}`})),
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          {label("Ширина", "sheet-w")}
          <NumberInput {...historyEditing}
            id="sheet-w"
            className={baseInputClasses}
            value={sheet.w}
            min={SHEET_MIN}
            max={SHEET_MAX}
            step={20}
            onCommit={(v) => setSheet(v, sheet.h)}
          />
        </div>
        <div className="space-y-1.5">
          {label("Высота", "sheet-h")}
          <NumberInput {...historyEditing}
            id="sheet-h"
            className={baseInputClasses}
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
