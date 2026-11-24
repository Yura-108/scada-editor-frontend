"use client";

import React from "react";
import { Group, Arrow } from "react-konva";
import { LeafElement, parseDashArray } from "@/core/scene";
import type { ShapeElementProps, ThemeColors } from "../types";
import { Anchor } from "./Anchor";

interface LineShapeElementProps extends ShapeElementProps {
  /** Вид элемента, уже посчитанный `ShapeElement` (состояние + рантайм). */
  rendered: LeafElement;
  themeColors: ThemeColors;
}

/** Линия: стрелки на концах (наконечник по толщине), концы тянутся ручками. */
export function LineShapeElement({ el, rendered, isSelected, snap, onElementClick, updateElementVisual, themeColors }: LineShapeElementProps) {
  const x1 = rendered.x1 ?? rendered.x;
  const y1 = rendered.y1 ?? rendered.y;
  const x2 = rendered.x2 ?? rendered.x + 80;
  const y2 = rendered.y2 ?? rendered.y;

  const lineStroke = isSelected ? themeColors.selection : (rendered.strokeColor || themeColors.strokeDefault);
  const lineWidth = rendered.strokeWidth || 2;
  const dashArr = parseDashArray(rendered.strokeDasharray);
  const arrowStart = !!rendered.arrowStart;
  const arrowEnd = !!rendered.arrowEnd;
  // Размер наконечника зависит от толщины линии.
  const pointerLength = Math.max(8, lineWidth * 2.5);
  const pointerWidth = Math.max(7, lineWidth * 2.2);

  return (
    <Group key={el.key} id={el.key}>
      <Arrow
        points={[x1, y1, x2, y2]}
        stroke={lineStroke}
        fill={lineStroke}
        strokeWidth={lineWidth}
        dash={dashArr}
        pointerAtBeginning={arrowStart}
        pointerAtEnding={arrowEnd}
        pointerLength={pointerLength}
        pointerWidth={pointerWidth}
        hitStrokeWidth={Math.max(12, lineWidth)}
        draggable
        onDragEnd={(e) => {
          const dx = e.target.x();
          const dy = e.target.y();
          e.target.position({ x: 0, y: 0 });
          updateElementVisual(el.key, {
            x1: x1 + dx, y1: y1 + dy,
            x2: x2 + dx, y2: y2 + dy,
            x: (x1 + x2) / 2 + dx, y: (y1 + y2) / 2 + dy,
          });
        }}
        onClick={(e) => {
          e.cancelBubble = true;
          onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
        }}
      />
      {isSelected && (
        <Anchor
          key={`${el.key}-anc-1`}
          x={x1}
          y={y1}
          themeColors={themeColors}
          onDragMove={(e) => {
            const sx = snap(e.target.x());
            const sy = snap(e.target.y());
            e.target.position({ x: sx, y: sy });
            // Пишем в стор только при пересечении шага сетки.
            if (sx !== x1 || sy !== y1) updateElementVisual(el.key, { x1: sx, y1: sy });
          }}
        />
      )}
      {isSelected && (
        <Anchor
          key={`${el.key}-anc-2`}
          x={x2}
          y={y2}
          themeColors={themeColors}
          onDragMove={(e) => {
            const sx = snap(e.target.x());
            const sy = snap(e.target.y());
            e.target.position({ x: sx, y: sy });
            // Пишем в стор только при пересечении шага сетки.
            if (sx !== x2 || sy !== y2) updateElementVisual(el.key, { x2: sx, y2: sy });
          }}
        />
      )}
    </Group>
  );
}
