"use client";

import {cn} from "@/shared/lib/cn";
import {GRID, MIN_TRACK} from "@/core/scene";
import {NumberInput} from "@/shared/ui/field/NumberInput";
import {useEditorStore} from "../../../../model/editorStore";
import type {TableTracks} from "../../lib/tableTracks";
import {baseInputClasses} from "../../panelClasses";

/**
 * Размеры таблицы, не привязанные к конкретной ячейке. «Выровнять»
 * стирает веса — раскладка возвращается к равномерной сетке.
 */
export function TableSizeSection({elementKey, tableTracks}: {elementKey: string; tableTracks: TableTracks}) {
  const updateElementVisual = useEditorStore(s => s.updateElementVisual);

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-2 uppercase tracking-wider">
        Размеры таблицы
      </h4>
      <div className="grid grid-cols-2 gap-4 items-end">
        {tableTracks.showHeader && (
          <div className="space-y-1.5">
            <label
              htmlFor="table-header-h"
              className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight"
            >
              Высота заголовка
            </label>
            <NumberInput
              id="table-header-h"
              className={baseInputClasses}
              value={Math.round(tableTracks.headerH)}
              step={GRID}
              onCommit={(v) => updateElementVisual(elementKey, {
                // Телу таблицы обязана остаться хотя бы клетка на строку.
                headerH: Math.min(
                  Math.max(MIN_TRACK, v),
                  Math.max(MIN_TRACK, tableTracks.h - tableTracks.rows * MIN_TRACK),
                ),
              })}
            />
          </div>
        )}
        <button
          type="button"
          className={cn(baseInputClasses, "cursor-pointer text-center hover:bg-gray-100 dark:hover:bg-neutral-800")}
          title="Сделать все столбцы и строки одинаковыми"
          onClick={() => updateElementVisual(elementKey, {colWidths: undefined, rowHeights: undefined})}
        >
          Выровнять
        </button>
      </div>
      <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700 mt-5" />
    </div>
  );
}
