"use client";

import React from "react";
import { Group, Rect, Line, Text, Circle } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

// Демонстрационные данные
const DEMO_BAR_VALUES = [65, 40, 80, 55, 90, 30, 72];
const DEMO_BAR_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл"];

export function ChartShapeElement({ el, isSelected, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const pad = 4;

  const w = rendered.w || 300;
  const h = rendered.h || 200;

  const chartType = (rendered.chartType as string) || "bar";
  const orientation = (rendered.orientation as string) || "vertical";
  const barColor = (rendered.barColor as string) || "#3b82f6";
  const bgColor = (rendered.backgroundColor as string) || "#1e293b";
  const strokeCol = (rendered.strokeColor as string) || "#475569";
  const textCol = (rendered.textColor as string) || "#94a3b8";
  const gridCol = (rendered.gridColor as string) || "#1e3a5f";
  const showGrid = rendered.showGrid !== false;
  const showValues = rendered.showValues !== false;
  const title = (rendered.title as string) || "";

  const marginL = 32;
  const marginB = 24;
  const marginT = title ? 24 : 10;
  const marginR = 8;
  const plotW = w - marginL - marginR;
  const plotH = h - marginT - marginB;

  const maxVal = Math.max(...DEMO_BAR_VALUES, 1);
  const barCount = DEMO_BAR_VALUES.length;
  const isHorizontal = orientation === "horizontal";

  // Сетка
  const gridLines: React.ReactElement[] = [];
  if (showGrid) {
    const gridCount = 4;
    if (!isHorizontal) {
      for (let i = 0; i <= gridCount; i++) {
        const y = marginT + (i / gridCount) * plotH;
        gridLines.push(
          <Line key={`gh-${i}`} points={[marginL, y, w - marginR, y]} stroke={gridCol} strokeWidth={1} listening={false} />
        );
      }
    } else {
      for (let i = 0; i <= gridCount; i++) {
        const x = marginL + (i / gridCount) * plotW;
        gridLines.push(
          <Line key={`gv-${i}`} points={[x, marginT, x, marginT + plotH]} stroke={gridCol} strokeWidth={1} listening={false} />
        );
      }
    }
  }

  // Подписи осей
  const axisLabels: React.ReactElement[] = [];
  if (!isHorizontal) {
    // Подписи по оси Y (левые)
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(((4 - i) / 4) * maxVal);
      const y = marginT + (i / 4) * plotH;
      axisLabels.push(
        <Text key={`yl-${i}`} x={0} y={y - 6} width={marginL - 4} text={val.toString()} fontSize={9} fill={textCol} align="right" listening={false} />
      );
    }
  } else {
    // Подписи по оси X (нижние) для горизонтального
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((i / 4) * maxVal);
      const x = marginL + (i / 4) * plotW;
      axisLabels.push(
        <Text key={`xl-${i}`} x={x - 12} y={marginT + plotH + 4} width={24} text={val.toString()} fontSize={9} fill={textCol} align="center" listening={false} />
      );
    }
  }

  // Рендеринг столбчатого или линейного графика
  const chartElements: React.ReactElement[] = [];

  if (chartType === "bar" || chartType === "area") {
    const gap = 4;
    const barSlot = isHorizontal ? plotH / barCount : plotW / barCount;
    const barThick = barSlot - gap;

    DEMO_BAR_VALUES.forEach((val, i) => {
      const ratio = val / maxVal;
      if (!isHorizontal) {
        const barH = ratio * plotH;
        const bx = marginL + i * barSlot + gap / 2;
        const by = marginT + plotH - barH;
        chartElements.push(
          <Rect key={`bar-${i}`} x={bx} y={by} width={barThick} height={barH} fill={barColor} cornerRadius={[2, 2, 0, 0]} listening={false} />
        );
        // Подпись под столбцом
        chartElements.push(
          <Text key={`bl-${i}`} x={bx} y={marginT + plotH + 4} width={barThick} text={DEMO_BAR_LABELS[i]} fontSize={9} fill={textCol} align="center" listening={false} />
        );
        // Значение над столбцом
        if (showValues) {
          chartElements.push(
            <Text key={`bv-${i}`} x={bx} y={by - 14} width={barThick} text={val.toString()} fontSize={9} fill={textCol} align="center" listening={false} />
          );
        }
      } else {
        const barW = ratio * plotW;
        const bx = marginL;
        const by = marginT + i * barSlot + gap / 2;
        chartElements.push(
          <Rect key={`bar-${i}`} x={bx} y={by} width={barW} height={barThick} fill={barColor} cornerRadius={[0, 2, 2, 0]} listening={false} />
        );
        // Подпись слева
        chartElements.push(
          <Text key={`bl-${i}`} x={0} y={by + barThick / 2 - 5} width={marginL - 4} text={DEMO_BAR_LABELS[i]} fontSize={9} fill={textCol} align="right" listening={false} />
        );
        // Значение справа от столбца
        if (showValues) {
          chartElements.push(
            <Text key={`bv-${i}`} x={bx + barW + 4} y={by + barThick / 2 - 5} width={30} text={val.toString()} fontSize={9} fill={textCol} align="left" listening={false} />
          );
        }
      }
    });
  } else if (chartType === "line") {
    // Линейный график (аналогично тренду, но с подписями категорий)
    const pts = DEMO_BAR_VALUES.map((val, i) => {
      const px = marginL + (i / (barCount - 1)) * plotW;
      const py = marginT + plotH - (val / maxVal) * plotH;
      return { px, py };
    });
    const flatPts = pts.flatMap(p => [p.px, p.py]);
    if (flatPts.length >= 4) {
      chartElements.push(
        <Line key="line" points={flatPts} stroke={barColor} strokeWidth={2} lineCap="round" lineJoin="round" listening={false} />
      );
    }
    pts.forEach((p, i) => {
      chartElements.push(
        <Circle key={`dot-${i}`} x={p.px} y={p.py} radius={3} fill={barColor} listening={false} />
      );
      // Подпись по X
      chartElements.push(
        <Text key={`lbl-${i}`} x={p.px - 14} y={marginT + plotH + 4} width={28} text={DEMO_BAR_LABELS[i]} fontSize={9} fill={textCol} align="center" listening={false} />
      );
    });
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
        <Text x={marginL} y={6} width={plotW} text={title} fontSize={11} fill={textCol} align="left" listening={false} />
      ) : null}

      {/* Сетка */}
      {gridLines}

      {/* Подписи осей */}
      {axisLabels}

      {/* Элементы диаграммы */}
      {chartElements}

      {/* Рамка области */}
      <Rect x={marginL} y={marginT} width={plotW} height={plotH} fill="transparent" stroke={strokeCol} strokeWidth={1} listening={false} />

      {/* Внешняя рамка */}
      <Rect x={0} y={0} width={w} height={h} fill="transparent" stroke={strokeCol} strokeWidth={1.5} cornerRadius={4} listening={false} />
    </Group>
  );
}
