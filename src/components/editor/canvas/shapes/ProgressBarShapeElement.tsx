"use client";

import React from "react";
import { useTheme } from "next-themes";
import { Group, Rect, Text } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";

export function ProgressBarShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const pad = 4;
  const w = rendered.w || 200;
  const h = rendered.h || 20;
  const value = Math.max(0, Math.min(100, Number(rendered.value) || 0));
  const isVertical = rendered.orientation === "vertical";

  const trackColor = rendered.backgroundColor || rendered.bg || (isDark ? "#3f3f46" : "#e5e7eb");
  const fillColor = rendered.color || "#3b82f6";
  const textCol = rendered.textColor || "#ffffff";
  const strokeCol = rendered.strokeColor;
  const showPct = rendered.showPercentage !== false;

  const length = isVertical ? h : w;
  const thickness = isVertical ? w : h;
  const fillLength = (length * value) / 100;
  const fillFull = fillLength >= length - 0.5;
  const r = Math.min(4, thickness / 2);

  const pct = `${Math.round(value)}%`;
  const labelText = (rendered.label ?? "").toString().trim();
  const displayText = showPct ? (labelText ? `${labelText} ${pct}` : pct) : labelText;

  // Уменьшили размер шрифта и высоту бокса текста, чтобы текст гарантированно помещался внутри бара
  const textBoxHeight = Math.max(8, Math.floor(thickness * 0.78));
  const fontSize = Math.max(9, Math.floor(textBoxHeight * 0.78));
  const showText = !!displayText && thickness >= 12;

  const fillRadius = fillFull
    ? r
    : isVertical
      ? [0, 0, r, r]
      : [r, 0, 0, r];

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

      {/* Трек (фон) */}
      <Rect x={0} y={0} width={w} height={h} fill={trackColor} cornerRadius={r} />

      {/* Заполнение */}
      {fillLength > 0 && (
        isVertical ? (
          <Rect x={0} y={h - fillLength} width={w} height={fillLength} fill={fillColor} cornerRadius={fillRadius} />
        ) : (
          <Rect x={0} y={0} width={fillLength} height={h} fill={fillColor} cornerRadius={fillRadius} />
        )
      )}

      {/* Рамка */}
      {strokeCol && (
        <Rect
          x={0} y={0} width={w} height={h}
          fill="transparent" stroke={strokeCol} strokeWidth={rendered.strokeWidth ?? 1}
          cornerRadius={r} listening={false}
        />
      )}

      {/* Текст */}
      {showText && (
        <Group
          x={w / 2}
          y={h / 2}
          rotation={isVertical ? -90 : 0}
          listening={false}
        >
          <Text
            x={-length / 2}
            y={-textBoxHeight / 2}           // ← изменено
            width={length}
            height={textBoxHeight}           // ← изменено (меньше толщины)
            text={displayText}
            fontSize={fontSize}
            fill={textCol}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}