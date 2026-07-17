"use client";

import React from "react";
import { Group, Rect, Line, Text } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";

export function TableShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const pad = 4;

  const w = rendered.w || 300;
  const h = rendered.h || 160;

  const rows = Math.max(1, Math.round(Number(rendered.rows ?? 4)));
  const cols = Math.max(1, Math.round(Number(rendered.cols ?? 3)));
  const showHeader = rendered.showHeader !== false;
  const headerText = (rendered.headerText as string) || "Таблица";
  const alternateRow = rendered.alternateRow !== false;

  const bgColor = rendered.backgroundColor || "#1e293b";
  const headerColor = rendered.headerColor || "#334155";
  const altColor = rendered.alternateColor || "#0f172a";
  const strokeCol = rendered.strokeColor || "#475569";
  const textCol = rendered.textColor || "#f8fafc";
  const fontSize = Math.max(8, Math.min(24, Number(rendered.fontSize ?? 12)));

  const headerH = showHeader ? Math.max(20, fontSize + 10) : 0;
  const bodyH = h - headerH;
  const rowH = bodyH / rows;
  const colW = w / cols;

  const lines: React.ReactElement[] = [];

  // Горизонтальные линии тела
  for (let r = 0; r <= rows; r++) {
    const y = headerH + r * rowH;
    lines.push(
      <Line key={`hr-${r}`} points={[0, y, w, y]} stroke={strokeCol} strokeWidth={1} listening={false} />
    );
  }

  // Вертикальные линии
  for (let c = 0; c <= cols; c++) {
    const x = c * colW;
    lines.push(
      <Line key={`vl-${c}`} points={[x, 0, x, h]} stroke={strokeCol} strokeWidth={1} listening={false} />
    );
  }

  // Чередующиеся строки
  const altRects: React.ReactElement[] = [];
  if (alternateRow) {
    for (let r = 0; r < rows; r++) {
      if (r % 2 === 1) {
        altRects.push(
          <Rect
            key={`alt-${r}`}
            x={0}
            y={headerH + r * rowH}
            width={w}
            height={rowH}
            fill={altColor}
            listening={false}
          />
        );
      }
    }
  }

  // Текст-заглушки в ячейках
  const cellTexts: React.ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cellTexts.push(
        <Text
          key={`cell-${r}-${c}`}
          x={c * colW + 4}
          y={headerH + r * rowH + rowH / 2 - fontSize / 2}
          width={colW - 8}
          text="—"
          fontSize={fontSize}
          fill={textCol}
          listening={false}
        />
      );
    }
  }

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

      {/* Фон */}
      <Rect x={0} y={0} width={w} height={h} fill={bgColor} cornerRadius={4} />

      {/* Чередующиеся строки */}
      {altRects}

      {/* Заголовок */}
      {showHeader && (
        <>
          <Rect x={0} y={0} width={w} height={headerH} fill={headerColor} cornerRadius={[4, 4, 0, 0]} />
          <Text
            x={8} y={headerH / 2 - fontSize / 2}
            width={w - 16}
            text={headerText}
            fontSize={fontSize}
            fontStyle="bold"
            fill={textCol}
            listening={false}
          />
        </>
      )}

      {/* Ячейки */}
      {cellTexts}

      {/* Сетка */}
      {lines}

      {/* Внешняя рамка */}
      <Rect x={0} y={0} width={w} height={h} fill="transparent" stroke={strokeCol} strokeWidth={1.5} cornerRadius={4} listening={false} />
    </Group>
  );
}
