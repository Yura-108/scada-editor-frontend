"use client";

import React from "react";
import { Group, Rect, Circle } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

export function SliderShapeElement({ el, isSelected, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;

  const pad = 4;
  const w = rendered.w || 160;
  const h = rendered.h || 20;
  const color = rendered.color || "#3b82f6";
  const trackCol = rendered.backgroundColor || "#d1d5db";

  const min = Number(rendered.min ?? 0);
  const max = Number(rendered.max ?? 100);
  const value = Number(rendered.value ?? 50);
  const span = max - min || 1;
  const pct = Math.max(0, Math.min(1, (value - min) / span));

  const knobR = h / 2 - 1;
  const knobCX = knobR + pct * (w - 2 * knobR);
  const trackH = Math.max(4, Math.min(8, Math.floor(h * 0.3)));
  const trackY = h / 2 - trackH / 2;

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      rotation={rendered.rotate || 0}
      draggable
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() });
      }}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <SelectionOutline x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} />
      )}
      {/* Трек */}
      <Rect x={0} y={trackY} width={w} height={trackH} cornerRadius={trackH / 2} fill={trackCol} />
      {/* Заполнение до ползунка */}
      <Rect x={0} y={trackY} width={knobCX} height={trackH} cornerRadius={trackH / 2} fill={color} />
      {/* Ползунок */}
      <Circle x={knobCX} y={h / 2} radius={knobR} fill="#ffffff" stroke={color} strokeWidth={2} />
      {/* Ресайз/поворот делает SelectionTransformer (Canvas). */}
    </Group>
  );
}
