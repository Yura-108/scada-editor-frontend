"use client";

import React from "react";
import { Group, Rect, Text } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";
import { ResizeHandleSE } from "./ResizeHandleSE";

export function InputShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;

  const pad = 4;
  const w = rendered.w || 160;
  const h = rendered.h || 40;
  const bg = rendered.backgroundColor || "#ffffff";
  const stroke = rendered.strokeColor || "#9ca3af";
  const textCol = rendered.textColor || "#1a1a1a";
  const value = String(rendered.value ?? "");
  const placeholder = rendered.placeholder ?? "";
  const hasValue = value.length > 0;
  const shown = hasValue ? value : placeholder;
  const fontSize = Math.max(11, Math.min(16, Math.floor(h * 0.35)));

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
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
      <Rect x={0} y={0} width={w} height={h} fill={bg} stroke={stroke} strokeWidth={1} cornerRadius={6} />
      <Text
        x={12} y={0} width={w - 24} height={h}
        text={shown} fontSize={fontSize}
        fill={hasValue ? textCol : "#9ca3af"}
        verticalAlign="middle" wrap="none" ellipsis listening={false}
      />
      {isSelected && (
        <ResizeHandleSE w={w} h={h} snap={snap} onResize={(nw, nh) => updateElementVisual(el.key, { w: nw, h: nh })} />
      )}
    </Group>
  );
}
