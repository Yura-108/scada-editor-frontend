"use client";

import React from "react";
import {Pencil, Plus, Trash2} from "lucide-react";
import {NumberInput} from "@/components/ui/NumberInput";
import OpenAddPropertyModal from "@/components/ui/OpenChooseTagModal";
import {confirmDeleteProperty} from "@/lib/editor/confirmDeleteProperty";
import {shortTagPath} from "@/lib/editor/tagPath";
import {
  TREND_DEFAULTS, TREND_LIMITS, TREND_WINDOW_PRESETS, nextPenName, readTrendSettings, trendPens, trendTiming,
} from "@/lib/editor/trendSettings";
import type {DiagramElement, TrendPenStyle, TrendSettings} from "@/types/editorElement.type";

interface Props {
  element: DiagramElement;
  onChange: (value: TrendSettings | undefined) => void;
  inputClassName: string;
  addButtonClassName: string;
  /** false — дерева устройств нет, тег перу выбрать не из чего. */
  canAddPen: boolean;
  addPenHint: string;
}

const labelClass = "block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight";

const formatWindow = (sec: number) =>
  TREND_WINDOW_PRESETS.find(p => p.seconds === sec)?.label ?? `${sec} с`;

/**
 * Настройка тренда (контракт 2026-09-28-tag-archive-contract.md, раздел 1).
 *
 * Перо — это тег-свойство элемента: добавляется той же формой свойства, только с готовым
 * именем `penN`, типом «Тег» и `float`. Здесь же его оформление — цвет, толщина и свой
 * масштаб по Y (пусто — по данным), которые едут в `trend.pens` под именем свойства.
 * Всё пишется в базу элемента (BASE_ONLY_KEYS): попадает в undo и помечает схему изменённой.
 */
export function TrendSettingsBlock({element, onChange, inputClassName, addButtonClassName, canAddPen, addPenHint}: Props) {
  const settings = readTrendSettings(element.trend);
  const {window: windowSec, step} = trendTiming(settings);
  const pens = trendPens(element);

  const commit = (patch: TrendSettings) => onChange(readTrendSettings({...settings, ...patch}));

  const commitPen = (name: string, patch: Partial<TrendPenStyle>, clear?: keyof TrendPenStyle) => {
    const current: TrendPenStyle = {...(settings?.pens?.[name] ?? {}), ...patch};
    if (clear) delete current[clear];
    commit({pens: {...(settings?.pens ?? {}), [name]: current}});
  };

  const presets = TREND_WINDOW_PRESETS.some(p => p.seconds === windowSec)
    ? TREND_WINDOW_PRESETS
    : [...TREND_WINDOW_PRESETS, {label: formatWindow(windowSec), seconds: windowSec}];

  const addPen = () => {
    if (!canAddPen) return;
    OpenAddPropertyModal({
      elementKey: element.key,
      preset: {name: nextPenName(element.properties), property_type: "Тег", value_type: "float"},
    });
  };

  return (
    <div className="pt-3 space-y-3">
      <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700" />
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Тренд</h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="trend-window" className={labelClass}>Окно</label>
          <select
            id="trend-window"
            className={inputClassName}
            value={windowSec}
            onChange={e => commit({window: Number(e.target.value)})}
          >
            {presets.map(p => <option key={p.seconds} value={p.seconds}>{p.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="trend-step" className={labelClass}>Шаг сетки, с</label>
          <NumberInput
            id="trend-step"
            className={inputClassName}
            value={settings?.step}
            placeholder={String(TREND_DEFAULTS.step)}
            min={TREND_LIMITS.step.min}
            max={TREND_LIMITS.step.max}
            step={60}
            onCommit={v => commit({step: v})}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Окно — сколько времени видно в мониторе; оператор может сменить его у себя, не сохраняя.
        Шаг — только сетка и подписи времени ({step} с).
      </p>

      {/* Одна ось на весь тренд (контракт 2026-09-29-trend-common-scale-contract.md): разные
          единицы приводятся к ней коэффициентом пера, а не своей шкалой у каждого. */}
      <div className="grid grid-cols-2 gap-3">
        {(["min", "max"] as const).map(key => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={`trend-scale-${key}`} className={labelClass}>
                Шкала Y: {key === "min" ? "мин" : "макс"}
              </label>
              {settings?.[key] !== undefined && (
                <button
                  type="button"
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => commit({[key]: undefined})}
                >
                  авто
                </button>
              )}
            </div>
            <NumberInput
              id={`trend-scale-${key}`}
              className={inputClassName}
              value={settings?.[key]}
              placeholder="авто"
              onCommit={v => commit({[key]: v})}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Пусто — по данным всех перьев. Единицу пишите в «Имя» пера («Масса, т»), а к шкале её
        приводит коэффициент: на графике значение тега × коэффициент.
      </p>

      <div className="space-y-2">
        <div className={labelClass}>Перья</div>
        {pens.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 italic">
            Перьев нет — тренд пустой.
          </div>
        )}
        {pens.map(pen => {
          const property = element.properties?.find(p => p.name === pen.name);
          const style = settings?.pens?.[pen.name];
          return (
            <div
              key={pen.name}
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
                    <button
                      type="button"
                      title="Изменить тег и подпись"
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                      onClick={() => OpenAddPropertyModal({elementKey: element.key, property})}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title="Удалить перо"
                      className="rounded p-1 text-red-500 hover:bg-red-500/10"
                      onClick={() => void confirmDeleteProperty(property, element.key)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`trend-${pen.name}-k`} className={labelClass}>Коэффициент</label>
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
                  <NumberInput
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
                  <label htmlFor={`trend-${pen.name}-width`} className={labelClass}>Толщина</label>
                  <NumberInput
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
        })}
      </div>

      <button
        type="button"
        className={canAddPen
          ? addButtonClassName
          : "flex items-center gap-2 py-2 rounded-xl text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed"}
        onClick={addPen}
        disabled={!canAddPen}
        title={canAddPen ? undefined : addPenHint}
      >
        <Plus size={18} />
        Добавить перо
      </button>
    </div>
  );
}
