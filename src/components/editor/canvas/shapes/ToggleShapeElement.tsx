"use client";

import React from "react";
import { Group, Rect, Circle, Text } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

export function ToggleShapeElement({ el, isSelected, onElementClick, updateElementVisual, stateId, runtime }: ShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;

  const pad = 4;
  const w = rendered.w || 40;
  const h = rendered.h || 20;
  const checked = !!rendered.checked;
  const onColor = rendered.color || "#22c55e";
  const offColor = rendered.backgroundColor || "#9ca3af";
  const textCol = rendered.textColor || "#e5e7eb";
  const label = rendered.label ?? "";

  const knobR = h / 2 - 2;
  const knobX = checked ? w - h / 2 : h / 2;
  const fontSize = Math.max(11, Math.min(16, Math.floor(h * 0.7)));

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
      {/* Дорожка-пилюля */}
      <Rect x={0} y={0} width={w} height={h} cornerRadius={h / 2} fill={checked ? onColor : offColor} />
      {/* Кнопка-кружок */}
      <Circle x={knobX} y={h / 2} radius={knobR} fill="#ffffff" shadowColor="#000000" shadowBlur={2} shadowOpacity={0.25} />
      {/* Подпись справа */}
      {label && (
        <Text x={w + 8} y={0} height={h} text={label} fontSize={fontSize} fill={textCol} verticalAlign="middle" listening={false} />
      )}
    </Group>
  );
}
