"use client";

import React from "react";
import {Layer, Rect} from "react-konva";
import type Konva from "konva";
import {DiagramElement} from "@/types/editorElement.type";
import type {ElementEventHandler, ElementEventName, ElementEvents} from "@/types/binding.types";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {getAbsoluteRenderedPos} from "@/lib/editor/getAbsoluteRenderedPos";
import {emitRuntimeEvent} from "@/lib/runtime/runtimeEventBus";

const hasScript = (h?: ElementEventHandler): boolean => Boolean(h && h.code && h.code.trim());

const findHandler = (events: ElementEvents | undefined, type: ElementEventName) =>
  events?.find(e => e.event_type === type)?.handler;

const isInteractive = (events?: ElementEvents): boolean =>
  hasScript(findHandler(events, "onClick")) || hasScript(findHandler(events, "onDoubleClick"));

/**
 * События компонента запускает ТОЛЬКО левая кнопка.
 *
 * Konva шлёт `click`/`dblclick` для любой кнопки мыши, поэтому без проверки правый клик по
 * элементу и открывал меню монитора, и запускал `onClick`-скрипт разом, а средняя (ею
 * панорамируют, см. useStageInteractions) запускала его на отпускании — оба раза оператор
 * не просил ничего выполнять. `button === 0` — левая.
 *
 * Касания (`onTap`/`onDblTap`) идут мимо: у `TouchEvent` кнопки нет, а тап и так только один.
 */
const leftButtonOnly = (run: () => void) => (e: Konva.KonvaEventObject<MouseEvent>) => {
  if (e.evt.button !== 0) return;
  run();
};

interface Props {
  elements: DiagramElement[];
  elementsMap: Record<string, DiagramElement>;
}

/**
 * Слой интеракции монитора: прозрачные хит-области над элементами с обработчиками
 * событий (onClick/onDoubleClick). Отдельный Layer (listening=true) поверх
 * основного (listening=false в readOnly) — клики по кнопкам работают, а остальная
 * сцена остаётся некликабельной. Координаты — мировые (Stage применяет камеру).
 */
export function MonitorInteractionLayer({elements, elementsMap}: Props) {
  const interactive = elements.filter(el => isInteractive(el.events));
  if (!interactive.length) return <Layer listening={false} />;

  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <Layer>
      {interactive.map(el => {
        const r = getRenderedElement(el) as unknown as Record<string, unknown>;
        const {x, y} = getAbsoluteRenderedPos(el, elementsMap);
        const w = Number(r.w) || 0;
        const h = Number(r.h) || 0;
        if (w <= 0 || h <= 0) return null;
        const rotation = Number(r.rotate ?? r.rotation ?? 0) || 0;
        const clickable = hasScript(findHandler(el.events, "onClick"));
        const dblClickable = hasScript(findHandler(el.events, "onDoubleClick"));
        return (
          <Rect
            key={el.key}
            x={x}
            y={y}
            width={w}
            height={h}
            rotation={rotation}
            fill="transparent"
            onMouseEnter={e => setCursor(e, "pointer")}
            onMouseLeave={e => setCursor(e, "default")}
            onClick={clickable ? leftButtonOnly(() => emitRuntimeEvent(el.key, "onClick")) : undefined}
            onTap={clickable ? () => emitRuntimeEvent(el.key, "onClick") : undefined}
            onDblClick={dblClickable ? leftButtonOnly(() => emitRuntimeEvent(el.key, "onDoubleClick")) : undefined}
            onDblTap={dblClickable ? () => emitRuntimeEvent(el.key, "onDoubleClick") : undefined}
          />
        );
      })}
    </Layer>
  );
}
