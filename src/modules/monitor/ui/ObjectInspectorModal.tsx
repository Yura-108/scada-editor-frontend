"use client";

import React from "react";
import {AlertTriangle} from "lucide-react";
import {Spinner} from "@/shared/ui/Spinner";
import {Banner} from "@/shared/ui/Banner";
import {EmptyState} from "@/shared/ui/EmptyState";
import {closeFloatingWindow, openFloatingWindow} from "../model/useFloatingWindowsStore";
import {Button, ModalFooter} from "@/shared/ui/Button";
import {useLiveValueTick} from "../model/useLiveValueTick";
import {useInspectorObjects} from "../model/inspector/useInspectorObjects";
import {useInspectorWrite} from "../model/inspector/useInspectorWrite";
import {InspectorPropertyRow} from "./inspector/InspectorPropertyRow";
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

  return (
    // Плавающее окно (заголовок — в его шапке): высоту задаёт окно, прокручивается список.
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 mb-4 space-y-2">
        <p className="text-muted-foreground text-sm">
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
          <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
            {selected.properties.map(p => (
              <InspectorPropertyRow
                key={p.id}
                property={p}
                draft={drafts[p.id] ?? ""}
                isWriting={writing === p.id}
                busy={writing !== null}
                onDraft={(value) => setDraft(p.id, value)}
                onWrite={() => void write(p)}
              />
            ))}
          </div>
        )}
      </div>

      <ModalFooter className="shrink-0 mt-6 pt-4 border-t border-border">
        <span className="mr-auto flex items-center gap-1.5 text-xs text-warning">
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
