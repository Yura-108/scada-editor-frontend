"use client";

import React from "react";
import { Group, Rect, Line, Text, Circle } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

// Демонстрационные данные (10 точек — синусоида)
const DEMO_POINTS_COUNT = 12;
const DEMO_VALUES = Array.from({ length: DEMO_POINTS_COUNT }, (_, i) =>
  50 + 35 * Math.sin((i / (DEMO_POINTS_COUNT - 1)) * Math.PI * 2.2)
);

export function TrendShapeElement({ el, isSelected, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const pad = 4;

  const w = rendered.w || 300;
  const h = rendered.h || 160;

  const bgColor = rendered.backgroundColor || "#1e293b";
  const lineColor = rendered.lineColor || "#3b82f6";
  const strokeCol = rendered.strokeColor || "#475569";
  const textCol = rendered.textColor || "#94a3b8";
  const gridCol = rendered.gridColor || "#1e3a5f";
  const showGrid = rendered.showGrid !== false;
  const showDots = !!rendered.showDots;
  const filled = !!rendered.filled;
  const fillColor = (rendered.fillColor as string) || "#1d4ed8";
  const title = (rendered.title as string) || "";

  const minVal = Number(rendered.min ?? 0);
  const maxVal = Number(rendered.max ?? 100);
  const range = maxVal !== minVal ? maxVal - minVal : 100;

  // Отступы внутри графика
  const marginL = 36;
  const marginB = 20;
  const marginT = title ? 22 : 8;
  const marginR = 8;
  const plotW = w - marginL - marginR;
  const plotH = h - marginT - marginB;

  // Нормализация точек в координаты холста
  const points = DEMO_VALUES.map((v, i) => {
    const px = marginL + (i / (DEMO_POINTS_COUNT - 1)) * plotW;
    const py = marginT + plotH - ((v - minVal) / range) * plotH;
    return { px, py, v };
  });

  // Сетка
  const gridLines: React.ReactElement[] = [];
  if (showGrid) {
    const gridCountH = 4;
    const gridCountV = 5;
    for (let i = 0; i <= gridCountH; i++) {
      const y = marginT + (i / gridCountH) * plotH;
      gridLines.push(
        <Line key={`gh-${i}`} points={[marginL, y, w - marginR, y]} stroke={gridCol} strokeWidth={1} listening={false} />
      );
    }
    for (let i = 0; i <= gridCountV; i++) {
      const x = marginL + (i / gridCountV) * plotW;
      gridLines.push(
        <Line key={`gv-${i}`} points={[x, marginT, x, marginT + plotH]} stroke={gridCol} strokeWidth={1} listening={false} />
      );
    }
  }

  // Плоские координаты для Line
  const flatPoints = points.flatMap(p => [p.px, p.py]);

  // Заливка под линией (замкнутый контур)
  const fillPoints = [
    marginL, marginT + plotH,
    ...flatPoints,
    w - marginR, marginT + plotH,
  ];

  // Подписи оси Y
  const yLabels: React.ReactElement[] = [];
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = minVal + ((ySteps - i) / ySteps) * range;
    const y = marginT + (i / ySteps) * plotH;
    yLabels.push(
      <Text
        key={`yl-${i}`}
        x={0} y={y - 6}
        width={marginL - 4}
        text={Math.round(val).toString()}
        fontSize={9}
        fill={textCol}
        align="right"
        listening={false}
      />
    );
  }

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <SelectionOutline x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} />
      )}

      {/* Фон */}
      <Rect x={0} y={0} width={w} height={h} fill={bgColor} cornerRadius={4} />

      {/* Заголовок */}
      {title ? (
        <Text x={marginL} y={4} width={plotW} text={title} fontSize={11} fill={textCol} align="left" listening={false} />
      ) : null}

      {/* Сетка */}
      {gridLines}

      {/* Ось Y подписи */}
      {yLabels}

      {/* Заливка под линией */}
      {filled && flatPoints.length >= 4 && (
        <Line points={fillPoints} closed fill={fillColor} opacity={0.3} stroke="transparent" listening={false} />
      )}

      {/* Линия тренда */}
      {flatPoints.length >= 4 && (
        <Line points={flatPoints} stroke={lineColor} strokeWidth={2} lineCap="round" lineJoin="round" listening={false} />
      )}

      {/* Точки данных */}
      {showDots && points.map((p, i) => (
        <Circle key={`dot-${i}`} x={p.px} y={p.py} radius={3} fill={lineColor} listening={false} />
      ))}

      {/* Рамка области графика */}
      <Rect
        x={marginL} y={marginT} width={plotW} height={plotH}
        fill="transparent" stroke={strokeCol} strokeWidth={1} listening={false}
      />

      {/* Внешняя рамка */}
      <Rect x={0} y={0} width={w} height={h} fill="transparent" stroke={strokeCol} strokeWidth={1.5} cornerRadius={4} listening={false} />
    </Group>
  );
}
