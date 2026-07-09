"use client";

import React from "react";
import { useTheme } from "next-themes";
import { Group, Rect, Line, Text } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";

export function CheckboxShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const BOX = 18;
  const pad = 4;
  const w = rendered.w || 160;
  const h = Math.max(rendered.h || 24, BOX);
  const boxY = (h - BOX) / 2;
  const checked = !!rendered.checked;
  const label = rendered.label ?? "Checkbox";
  const accent = rendered.color || rendered.strokeColor || "#3b82f6";
  const textCol = rendered.textColor || (isDark ? "#ffffff" : "#1a1a1a");
  const fontSize = rendered.fontSize || 14;
  const boxBg = isDark ? "#0a0a0a" : "#ffffff";

  // Галочка: три точки образуют ✓
  const ckPts = [
    BOX * 0.15, BOX * 0.50,
    BOX * 0.42, BOX * 0.76,
    BOX * 0.85, BOX * 0.20,
  ];

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => updateElementVisual(el.key, { x: snap(e.target.x()), y: snap(e.target.y()) })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <Rect
          x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2}
          fill="transparent" stroke="#3b82f6" strokeWidth={1.5} dash={[4, 3]} listening={false}
        />
      )}
      {/* Квадрат чекбокса */}
      <Rect
        x={0} y={boxY} width={BOX} height={BOX}
        fill={checked ? accent : boxBg}
        stroke={accent} strokeWidth={1.5} cornerRadius={3}
      />
      {/* Галочка */}
      {checked && (
        <Line
          x={0} y={boxY}
          points={ckPts}
          stroke="#ffffff" strokeWidth={2.5}
          lineCap="round" lineJoin="round" listening={false}
        />
      )}
      {/* Подпись */}
      {label && (
        <Text
          x={BOX + 8} y={0}
          text={label} fontSize={fontSize}
          fill={textCol} width={w - BOX - 8} height={h}
          verticalAlign="middle"
        />
      )}
    </Group>
  );
}
