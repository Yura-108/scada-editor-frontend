"use client";

import React from "react";
import { Group, Rect, Line, Text } from "react-konva";
import Konva from "konva";
import { LeafElement, TableCellData } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import { getCellData } from "@/lib/editor/tableCells";
import { cellBindingAt, resolveCellText } from "@/lib/editor/tableBindings";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

interface TableShapeElementProps extends ShapeElementProps {
  /** Ячейка, сфокусированная в панели свойств (для этой таблицы), или null. */
  focusedCell: { elementKey: string; row: number; col: number } | null;
  /** Клик по конкретной ячейке — выделяет таблицу и фокусирует ячейку в панели свойств. */
  onCellClick: (elementKey: string, row: number, col: number, multi: boolean) => void;
}

/** Цвет подсветки сфокусированной ячейки — намеренно отличается от синей пунктирной
 *  рамки выделения таблицы и розовых smart-guides (цвета — в useThemeColors). */
const CELL_FOCUS_COLOR = "#f59e0b";

/** Уголок-пометка привязанной ячейки: размер и цвет. */
const CELL_BOUND_MARK = 6;
const CELL_BOUND_COLOR = "#10b981";

export function TableShapeElement({ el, isSelected, onElementClick, updateElementVisual, focusedCell, onCellClick, stateId, runtime }: TableShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;
  const renderedAny = rendered as unknown as Record<string, unknown>;
  const pad = 4;

  const w = rendered.w || 300;
  const h = rendered.h || 160;

  const rows = Math.max(1, Math.round(Number(rendered.rows ?? 4)));
  const cols = Math.max(1, Math.round(Number(rendered.cols ?? 3)));
  const showHeader = rendered.showHeader !== false;
  const headerText = (rendered.headerText as string) || "Таблица";
  const alternateRow = rendered.alternateRow === true;

  const bgColor = rendered.backgroundColor || "transparent";
  const headerColor = rendered.headerColor || "transparent";
  const altColor = rendered.alternateColor || "#f1f5f9";
  const strokeCol = rendered.strokeColor || "#000000";
  const textCol = rendered.textColor || "#000000";
  const fontSize = Math.max(8, Math.min(24, Number(rendered.fontSize ?? 12)));

  const cellsMap = rendered.cells as Record<string, TableCellData> | undefined;

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

  // Ячейки: фон (кликабельный, хит-таргет для выбора ячейки), значение (статика или
  // живой оверрайд из привязки к тегу), подсветка сфокусированной ячейки.
  const cellNodes: React.ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const data = getCellData(cellsMap, r, c);
      // Раскладку задаёт пользователь привязками ячеек, а не рендер: прежняя жёсткая
      // конвенция «0 — номер, 1 — имя, 2 — значение» ушла вместе со строковыми привязками.
      const displayValue = resolveCellText(el, renderedAny, r, c);
      const bound = cellBindingAt(el, r, c) !== undefined;
      const cx = c * colW;
      const cy = headerH + r * rowH;
      const focused = focusedCell !== null && focusedCell.elementKey === el.key
        && focusedCell.row === r && focusedCell.col === c;

      cellNodes.push(
        <Rect
          key={`cell-bg-${r}-${c}`}
          x={cx} y={cy} width={colW} height={rowH}
          fill={data.backgroundColor || "transparent"}
          onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true;
            onCellClick(el.key, r, c, e.evt.shiftKey || e.evt.ctrlKey);
          }}
        />
      );
      // Привязанная ячейка помечена уголком: иначе в редакторе её не отличить от
      // ячейки со свободным текстом — обе показывают просто строку.
      if (bound) {
        cellNodes.push(
          <Line
            key={`cell-bound-${r}-${c}`}
            points={[cx + colW - CELL_BOUND_MARK, cy, cx + colW, cy, cx + colW, cy + CELL_BOUND_MARK]}
            closed
            fill={CELL_BOUND_COLOR}
            listening={false}
          />
        );
      }
      cellNodes.push(
        <Text
          key={`cell-text-${r}-${c}`}
          x={cx + 4} y={cy + rowH / 2 - fontSize / 2}
          width={colW - 8}
          text={displayValue}
          fontSize={fontSize}
          align={data.align || "left"}
          fill={data.textColor || textCol}
          listening={false}
        />
      );
      if (focused) {
        cellNodes.push(
          <Rect
            key={`cell-focus-${r}-${c}`}
            x={cx} y={cy} width={colW} height={rowH}
            fill="transparent" stroke={CELL_FOCUS_COLOR} strokeWidth={2} listening={false}
          />
        );
      }
    }
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

      {/* Ячейки: фон + значение + подсветка фокуса */}
      {cellNodes}

      {/* Сетка */}
      {lines}

      {/* Внешняя рамка */}
      <Rect x={0} y={0} width={w} height={h} fill="transparent" stroke={strokeCol} strokeWidth={1.5} cornerRadius={4} listening={false} />
    </Group>
  );
}
