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
            onClick={clickable ? () => emitRuntimeEvent(el.key, "onClick") : undefined}
            onTap={clickable ? () => emitRuntimeEvent(el.key, "onClick") : undefined}
            onDblClick={dblClickable ? () => emitRuntimeEvent(el.key, "onDoubleClick") : undefined}
            onDblTap={dblClickable ? () => emitRuntimeEvent(el.key, "onDoubleClick") : undefined}
          />
        );
      })}
    </Layer>
  );
}
