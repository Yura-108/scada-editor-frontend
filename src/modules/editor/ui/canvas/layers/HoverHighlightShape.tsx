"use client";

import { Circle, Line, Rect } from "react-konva";
import type { HoverHighlight } from "../hooks/useHoverHighlight";

/**
 * Hover-подсветка: один оверлей вместо пропса в фигуры — иначе каждое
 * движение мыши ре-рендерило бы всю мемоизированную сцену.
 *
 * Форма повторяет геометрию фигуры, а не её габарит: у наклонного отрезка
 * габаритный прямоугольник накрывает пол-листа вместе с соседями, и понять
 * по нему, что именно выберется, невозможно (см. useHoverHighlight).
 *
 * strokeScaleEnabled={false} — толщина и штрих в ЭКРАННЫХ пикселях: подсветка
 * остаётся одинаково тонкой и на общем виде листа, и при сильном приближении.
 */
export function HoverHighlightShape({ highlight, color }: { highlight: HoverHighlight; color: string }) {
  const common = {
    stroke: color,
    strokeWidth: 1.5,
    dash: [5, 3],
    opacity: 0.7,
    strokeScaleEnabled: false,
    listening: false,
  };

  if (highlight.kind === "line") {
    return (
      <Line
        {...common}
        points={highlight.points}
        // Сплошная и толще: подсветка ложится поверх самой линии, и пунктир
        // на пунктире читался бы хуже, чем «утолщение» под курсором.
        dash={undefined}
        strokeWidth={4}
        opacity={0.45}
      />
    );
  }

  if (highlight.kind === "circle") {
    return (
      <Circle
        {...common}
        x={highlight.x}
        y={highlight.y}
        radius={highlight.radius + 2}
      />
    );
  }

  if (highlight.kind === "polygon") {
    return <Line {...common} points={highlight.points} closed />;
  }

  return (
    <Rect
      {...common}
      x={highlight.x - 2}
      y={highlight.y - 2}
      width={highlight.w + 4}
      height={highlight.h + 4}
      cornerRadius={2}
    />
  );
}
