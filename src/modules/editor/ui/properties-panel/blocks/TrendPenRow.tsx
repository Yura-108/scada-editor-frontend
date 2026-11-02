"use client";

import React from "react";
import {Pencil, Trash2} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {NumberInput} from "@/shared/ui/field/NumberInput";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";
import {shortTagPath, TREND_DEFAULTS, TREND_LIMITS, trendPens} from "@/core/scene";
import type {DiagramElement, TrendPenStyle} from "@/core/scene";
import OpenAddPropertyModal from "../property/PropertyModal";
import {confirmDeleteProperty} from "../../../lib/confirmDeleteProperty";
import {historyEditing} from "../../../model/historyGroup";

const labelClass = fieldLabelSmClass;

/** Перо тренда: цвет, подпись и тег, правка и удаление свойства, коэффициент, сдвиг, толщина. */
export function TrendPenRow({pen, property, style, elementKey, inputClassName, commitPen}: {
  pen: ReturnType<typeof trendPens>[number];
  property: NonNullable<DiagramElement["properties"]>[number] | undefined;
  style: TrendPenStyle | undefined;
  elementKey: string;
  inputClassName: string;
  commitPen: (name: string, patch: Partial<TrendPenStyle>, clear?: keyof TrendPenStyle) => void;
}) {
  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-neutral-700 p-2 space-y-2"
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Цвет пера ${pen.label}`}
          value={pen.color}
          onChange={e => commitPen(pen.name, {color: e.target.value})}
          className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-gray-800 dark:text-gray-200">
            {pen.label}
            {pen.label !== pen.name && (
              <span className="ml-1 font-mono text-xs text-gray-500">{pen.name}</span>
            )}
          </div>
          <div className="truncate text-xs text-gray-500" title={pen.tag}>{shortTagPath(pen.tag)}</div>
        </div>
        {property && (
          <>
            <IconButton icon={Pencil} label="Изменить тег и подпись" size="xs" onClick={() => OpenAddPropertyModal({elementKey, property})} />
            <IconButton icon={Trash2} label="Удалить перо" size="xs" variant="danger" onClick={() => void confirmDeleteProperty(property, elementKey)} />
          </>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor={`trend-${pen.name}-k`} className={labelClass} title="На графике: значение × коэффициент + сдвиг">Коэфф.</label>
            {style?.k !== undefined && (
              <button
                type="button"
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() => commitPen(pen.name, {}, "k")}
              >
                сбросить
              </button>
            )}
          </div>
          <NumberInput {...historyEditing}
            id={`trend-${pen.name}-k`}
            className={inputClassName}
            value={style?.k}
            placeholder="1"
            step={0.001}
            // 0 обнулил бы перо — readTrendSettings такой коэффициент не примет.
            onCommit={v => commitPen(pen.name, {k: v})}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor={`trend-${pen.name}-b`} className={labelClass} title="Разводит дискретные сигналы по высоте: ступеньки 0/5 не лягут друг на друга">Сдвиг</label>
            {style?.b !== undefined && (
              <button
                type="button"
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() => commitPen(pen.name, {}, "b")}
              >
                сбросить
              </button>
            )}
          </div>
          <NumberInput {...historyEditing}
            id={`trend-${pen.name}-b`}
            className={inputClassName}
            value={style?.b}
            placeholder="0"
            onCommit={v => commitPen(pen.name, {b: v})}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`trend-${pen.name}-width`} className={labelClass}>Толщина</label>
          <NumberInput {...historyEditing}
            id={`trend-${pen.name}-width`}
            className={inputClassName}
            value={style?.width}
            placeholder={String(TREND_DEFAULTS.penWidth)}
            min={TREND_LIMITS.width.min}
            max={TREND_LIMITS.width.max}
            onCommit={v => commitPen(pen.name, {width: v})}
          />
        </div>
      </div>
    </div>
  );
}
