"use client";

import React from "react";
import { Group, Line } from "react-konva";
import { LeafElement, parseDashArray } from "@/core/scene";
import type { ShapeElementProps, ThemeColors } from "../types";
import { Anchor } from "./Anchor";

interface PolygonShapeElementProps extends ShapeElementProps {
  /** Вид элемента, уже посчитанный `ShapeElement` (состояние + рантайм). */
  rendered: LeafElement;
  themeColors: ThemeColors;
  /** Клик по многоугольнику закрывает открытое контекстное меню. */
  closeMenu: () => void;
}

/** Многоугольник: точки из модели или правильный по числу сторон; вершины тянутся ручками. */
export function PolygonShapeElement({ el, rendered, isSelected, snap, onElementClick, updateElementVisual, closeMenu, themeColors }: PolygonShapeElementProps) {
  let pts: number[] = [];
  const pointsData = rendered.points as string | number[] | undefined;

  if (typeof pointsData === "string") {
    try { pts = JSON.parse(pointsData); } catch { pts = []; }
  } else if (Array.isArray(pointsData)) {
    pts = pointsData;
  }

  const expectedLen = (rendered.sides || 3) * 2;
  if (pts.length !== expectedLen) {
    const sides = rendered.sides || 3;
    const radius = rendered.radius || 40;

    const cx = rendered.w / 2;
    const cy = rendered.h / 2;

    pts = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      pts.push(cx + radius * Math.cos(angle));
      pts.push(cy + radius * Math.sin(angle));
    }
  }

  return (
    <Group key={el.key} id={el.key} x={rendered.x} y={rendered.y}>
      <Line
        points={pts as number[]}
        closed={true}
        fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
        stroke={isSelected ? themeColors.selection : (rendered.strokeColor || themeColors.strokeDefault)}
        strokeWidth={isSelected ? 3 : (rendered.strokeWidth || 2)}
        dash={parseDashArray(rendered.strokeDasharray)}
        draggable
        onDragEnd={(e) => {
          const node = e.target;
          const dx = node.x();
          const dy = node.y();
          node.position({ x: 0, y: 0 });
          // Смещение уже привязано общим обработчиком Stage (сетка +
          // направляющие, см. useMultiDragAndGuides) — повторно не снапим.
          updateElementVisual(el.key, {
            x: rendered.x + dx,
            y: rendered.y + dy,
          });
        }}
        onClick={(e) => {
          e.cancelBubble = true;
          closeMenu();
          onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
        }}
      />
      {isSelected && (pts as number[]).map((p, i) => {
        if (i % 2 !== 0) return null; // skip y
        return (
          <Anchor
            key={`${el.key}-anc-${i}`}
            x={p}
            y={(pts as number[])[i + 1]}
            themeColors={themeColors}
            onDragMove={(e) => {
              const sx = snap(e.target.x());
              const sy = snap(e.target.y());
              e.target.position({ x: sx, y: sy });
              // Пишем в стор только при пересечении шага сетки.
              if (sx !== (pts as number[])[i] || sy !== (pts as number[])[i + 1]) {
                const cp = [...(pts as number[])];
                cp[i] = sx;
                cp[i + 1] = sy;
                updateElementVisual(el.key, { points: cp });
              }
            }}
          />
        );
      })}
    </Group>
  );
}
