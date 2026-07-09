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

  // For vertical: fill grows along height; for horizontal: along width
  const trackLength = isVertical ? h : w;
  const fillLength = (trackLength * value) / 100;
  const thickness = isVertical ? w : h;

  const trackColor = rendered.bg || (isDark ? "#3f3f46" : "#e5e7eb");
  const fillColor = rendered.color || "#3b82f6";
  const textCol = rendered.textColor || "#ffffff";
  const showPct = rendered.showPercentage !== false;
  const r = Math.min(4, Math.min(trackLength, thickness) / 2);
  const fillFull = fillLength >= trackLength - 0.5;

  // Position of the fill rect
  const fillX = isVertical ? 0 : 0;
  const fillY = isVertical ? (trackLength - fillLength) : 0;
  const fillW = isVertical ? thickness : fillLength;
  const fillH = isVertical ? fillLength : thickness;

  // Corner radii: rounded only on the leading edge of the fill
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
        <Rect
          x={fillX} y={fillY} width={fillW} height={fillH}
          fill={fillColor}
          cornerRadius={fillRadius}
        />
      )}
      {/* Процент */}
      {showPct && (
        isVertical ? (
          // Vertical: rotate text 90deg around the track center
          thickness >= 12 && (
            <Text
              x={-h / 2} y={thickness / 2 - (Math.max(10, Math.floor(thickness * 0.62)))}
              width={h} height={thickness}
              rotation={-90}
              text={`${Math.round(value)}%`}
              fontSize={Math.max(10, Math.floor(thickness * 0.62))}
              fill={textCol} align="center" verticalAlign="middle"
              listening={false}
            />
          )
        ) : (
          h >= 12 && (
            <Text
              x={0} y={0} width={w} height={h}
              text={`${Math.round(value)}%`}
              fontSize={Math.max(10, Math.floor(h * 0.62))}
              fill={textCol} align="center" verticalAlign="middle"
              listening={false}
            />
          )
        )
      )}
    </Group>
  );
}
