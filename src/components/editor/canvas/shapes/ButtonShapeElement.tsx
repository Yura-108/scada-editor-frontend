"use client";

import React from "react";
import { Group, Rect, Text } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";

export function ButtonShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;

  const pad = 4;
  const w = rendered.w || 120;
  const h = rendered.h || 40;
  const color = rendered.color || "#3b82f6";
  const textColor = rendered.textColor || "#ffffff";
  const label = rendered.label ?? "Кнопка";
  const rx = rendered.rx ?? 6;
  const pressed = !!rendered.pressed;
  const enabled = rendered.enabled !== false;
  const fontSize = Math.max(11, Math.min(18, Math.floor(h * 0.4)));

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      rotation={rendered.rotate || 0}
      opacity={enabled ? 1 : 0.5}
      draggable
      onDragMove={(e) => {
        if (e.target === e.currentTarget) e.target.position({ x: snap(e.target.x()), y: snap(e.target.y()) });
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        updateElementVisual(el.key, { x: snap(e.target.x()), y: snap(e.target.y()) });
      }}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <Rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2}
          fill="transparent" stroke="#3b82f6" strokeWidth={1.5} dash={[4, 3]} listening={false} />
      )}
      <Rect x={0} y={0} width={w} height={h} fill={color} cornerRadius={rx} />
      {pressed && <Rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.18)" cornerRadius={rx} listening={false} />}
      <Text
        x={0} y={pressed ? 1 : 0} width={w} height={h}
        text={label} fontSize={fontSize} fill={textColor}
        align="center" verticalAlign="middle" listening={false}
      />
      {/* Ресайз/поворот делает SelectionTransformer (Canvas). */}
    </Group>
  );
}
