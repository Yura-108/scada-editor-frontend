"use client";

import React from "react";
import { useTheme } from "next-themes";
import { Group, Rect, Line, Text } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

export function CheckboxShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const BOX = 18;
  const pad = 4;
  const w = rendered.w || 160;
  const h = Math.max(rendered.h || 20, BOX);
  const boxY = (h - BOX) / 2;
  const checked = !!rendered.checked;
  const label = rendered.label ?? "Checkbox";
  const accent = rendered.color || "#3b82f6";            // Цвет при отметке (заливка + акцент)
  const boxStroke = rendered.strokeColor || accent;       // Цвет рамки (независимо от акцента)
  const boxBg = rendered.backgroundColor || (isDark ? "#0a0a0a" : "#ffffff"); // Фон квадрата (когда снят)
  const textCol = rendered.textColor || (isDark ? "#ffffff" : "#1a1a1a");
  const fontSize = rendered.fontSize || 14;

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
      rotation={rendered.rotate || 0}
      draggable
      onDragMove={(e) => {
        // Живой снаппинг во время перетаскивания — элемент чётко «щёлкает» по клеткам сетки.
        e.target.position({ x: snap(e.target.x()), y: snap(e.target.y()) });
      }}
      onDragEnd={(e) => updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <SelectionOutline x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} />
      )}
      {/* Квадрат чекбокса */}
      <Rect
        x={0} y={boxY} width={BOX} height={BOX}
        fill={checked ? accent : boxBg}
        stroke={boxStroke} strokeWidth={1.5} cornerRadius={3}
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
