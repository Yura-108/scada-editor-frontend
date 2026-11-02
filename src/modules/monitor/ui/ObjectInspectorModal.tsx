"use client";

import React from "react";
import {AlertTriangle, SlidersHorizontal, Waypoints} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Spinner} from "@/shared/ui/Spinner";
import {Banner} from "@/shared/ui/Banner";
import {EmptyState} from "@/shared/ui/EmptyState";
import {closeFloatingWindow, openFloatingWindow} from "../model/useFloatingWindowsStore";
import {isBooleanValueType, isNumericValueType, shortTagPath} from "@/core/scene";
import {getRuntimePropertyValue, getRuntimeTagQuality, getRuntimeTagValue, InspectorPropertyDto} from "@/core/runtime";
import {Button, ModalFooter} from "@/shared/ui/Button";
import {useLiveValueTick} from "../model/useLiveValueTick";
import {useInspectorObjects} from "../model/inspector/useInspectorObjects";
import {useInspectorWrite} from "../model/inspector/useInspectorWrite";
import {inspectorTitle as title} from "../lib/inspectorProps";
import {ValueWriteRow} from "./ValueWriteRow";
import {ObjectPicker} from "./ObjectPicker";

/**
 * Инспектор объектов монитора (docs/contract/2026-10-01-object-inspector-contract.md).
 *
 * Любой объект prod-выпуска со всех сцен и все его свойства: с тегом — живое значение из
 * телеметрии, локальные — значение, которое держит runtime (его пишут скрипты). Значения приходят
 * по WS, движок держит их в рефах и отдаёт геттерами шины; WS подписан на открытую сцену, поэтому
 * теги выбранного объекта окно регистрирует в runtimeTagInterest.
 *
 * Запись: теговое — в ПЛК (`tags/write`), как «Опции»; локальное — `properties/write`. Записанное
 * локально не подставляем: UPDATE приходит за десятки миллисекунд, и только он гарантирует, что
 * окно показывает то, что на самом деле лежит в runtime.
 */
function ObjectInspectorContent({initialObjectId, onClose}: {initialObjectId?: number; onClose: () => void}) {
  const {objects, loading, loadError, selectedId, setSelectedId, selected, reload} = useInspectorObjects(initialObjectId);
  const {drafts, setDraft, clearDrafts, writing, write} = useInspectorWrite(reload);
  useLiveValueTick();

  const selectObject = (id: number | null) => {
    setSelectedId(id);
    // Черновики принадлежали прошлому объекту.
    clearDrafts();
  };

  const valueOf = (p: InspectorPropertyDto) =>
    p.tag_id ? getRuntimeTagValue(p.tag_id) : getRuntimePropertyValue(p.id);
  const isBad = (p: InspectorPropertyDto) => {
    if (!p.tag_id) return false;
    const quality = getRuntimeTagQuality(p.tag_id);
    return quality !== undefined && quality !== "GOOD";
  };

  return (
    // Плавающее окно (заголовок — в его шапке): высоту задаёт окно, прокручивается список.
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 mb-4 space-y-2">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Свойства любого объекта проекта. Теговые записываются в ПЛК, локальные — в runtime.
        </p>
        <ObjectPicker
          objects={objects}
          selected={selected}
          loading={loading}
          onSelect={id => selectObject(id)}
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
        {loadError ? (
          <Banner tone="warning" icon={AlertTriangle}>{loadError}</Banner>
        ) : loading && !objects.length ? (
          <Spinner label="Загрузка объектов…" className="min-h-[120px] justify-center" />
        ) : !selected ? (
          <EmptyState
            size="sm"
            className="min-h-[120px] justify-center"
            title={initialObjectId != null && selectedId === initialObjectId
              ? "У этого объекта нет свойств в выпуске — выберите другой"
              : "Выберите объект"}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800/70">
            {selected.properties.map(p => {
              const value = valueOf(p);
              const isBool = isBooleanValueType(p.value_type ?? "");
              const draft = drafts[p.id] ?? "";
              const bad = isBad(p);
              return (
                <div key={p.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    {p.tag_id
                      ? <Waypoints className="h-4 w-4 shrink-0 text-indigo-500" aria-label="тег" />
                      : <SlidersHorizontal className="h-4 w-4 shrink-0 text-gray-400" aria-label="локальное свойство" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {title(p)}
                      </span>
                      {/* Как в «Опциях»: короткий путь тега, полный — в title; технический name
                          рядом, если подпись его скрыла. */}
                      <span
                        className="block truncate text-xs text-gray-500 dark:text-gray-400"
                        title={p.tag_id || undefined}
                      >
                        {p.label?.trim() ? `${p.name} · ` : ""}
                        {p.tag_id ? shortTagPath(p.tag_id) : "локальное свойство"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          bad ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100",
                        )}
                        title={bad ? "Значение недостоверно (качество тега не GOOD)" : undefined}
                      >
                        {value == null ? (p.tag_id ? "нет данных" : "не задано") : String(value)}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        текущее значение
                      </span>
                    </span>
                  </div>

                  <ValueWriteRow
                    isBool={isBool}
                    numeric={isNumericValueType(p.value_type)}
                    draft={draft}
                    onDraft={(value) => setDraft(p.id, value)}
                    onWrite={() => void write(p)}
                    disabled={writing !== null || (!isBool && !draft.trim())}
                    label={writing === p.id ? "Запись..." : p.tag_id ? "Записать в ПЛК" : "Задать"}
                    danger={Boolean(p.tag_id)}
                    submitOnEnter
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalFooter className="shrink-0 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800/80">
        <span className="mr-auto flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} />
          Запись в ПЛК необратима
        </span>
        <Button onClick={onClose}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

/**
 * Открывает инспектор плавающим окном — схема рядом остаётся рабочей. Инспектор один: повторный
 * вызов (например, из меню другого компонента) поднимает окно и выбирает новый объект.
 * `initialObjectId` — сразу выбрать объект.
 */
export function openObjectInspectorModal(props: {initialObjectId?: number} = {}) {
  const id = "inspector";
  openFloatingWindow({
    id,
    kind: "inspector",
    title: "Инспектор объектов",
    width: 560,
    content: <ObjectInspectorContent {...props} onClose={() => closeFloatingWindow(id)} />,
  });
}
