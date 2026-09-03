"use client";

import React, { useRef } from "react";
import { Rect } from "react-konva";
import Konva from "konva";
import { resetCanvasCursor } from "@/lib/editor/canvasCursor";
import { snap } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";
import { MIN_TRACK, resizeTrackAt, sameTracks, trackOffsets } from "@/lib/editor/tableLayout";
import { MIN_SIZE, type ThemeColors } from "../types";

interface TableResizeHandlesProps {
  elKey: string;
  /** Геометрия таблицы в координатах родителя (x/y) и её собственные размеры. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Высота шапки (0, если шапка выключена) и абсолютные размеры полос. */
  headerH: number;
  colWs: number[];
  rowHs: number[];
  showHeader: boolean;
  themeColors: ThemeColors;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
}

/**
 * Ручки таблицы: габарит (8 штук по рамке) и границы полос (столбцы, строки,
 * низ шапки).
 *
 * Почему у таблицы свои ручки, а не общий `SelectionTransformer`:
 *
 *  1. Transformer масштабирует узел ИМПЕРАТИВНО (scale) и пересчитывает его в w/h
 *     только на отпускании — у таблицы вместе с рамкой растягивались бы кегль, линии
 *     сетки и текст ячеек, а на отпускании всё это скачком возвращалось бы обратно.
 *     Здесь превью настоящее: коммит идёт на каждом шаге сетки, и сетка перестраивается
 *     по-честному.
 *  2. Он коммитит `rotate`, а рендер таблицы `rotation` не применяет — повёрнутая
 *     таблица молча расходилась бы со своим габаритом.
 *  3. Ручки полос всё равно нужны свои, и держать два разных механизма на одной фигуре
 *     (якоря снаружи + разделители внутри) — лишняя мина.
 *
 * Общий приём всех ручек: сам узел ручки НЕ двигается (`dragBoundFunc` возвращает его
 * текущую абсолютную позицию), а геометрия считается от ПОЗИЦИИ КУРСОРА в системе
 * координат родителя. Иначе ручки левого/верхнего края уводило бы в разнос: они
 * сдвигают начало координат группы, Konva держит узел на месте в АБСОЛЮТНЫХ
 * координатах, и локальная координата ручки на следующем кадре уезжала бы ровно на
 * величину сдвига. От курсора же считается всегда одно и то же.
 */
export function TableResizeHandles({
  elKey, x, y, w, h, headerH, colWs, rowHs, showHeader, themeColors, updateElementVisual,
}: TableResizeHandlesProps) {
  // Экранно-постоянный размер ручек. Подписка локальная — при зуме перерисовываются
  // только ручки выделенной таблицы, а не вся сцена (см. Anchor/CircleResizeHandle).
  const zoom = useEditorStore(s => s.camera.zoom);
  const size = 8 / zoom;
  const grip = 8 / zoom;
  const stroke = 1.5 / zoom;

  const colX = trackOffsets(colWs);
  const rowY = trackOffsets(rowHs);

  // Восемь ручек габарита: dirX/dirY — какой край тянется (−1 левый/верхний,
  // +1 правый/нижний, 0 — не двигается).
  const box: Array<{ name: string; hx: number; hy: number; dirX: -1 | 0 | 1; dirY: -1 | 0 | 1; cursor: string }> = [
    { name: "nw", hx: 0, hy: 0, dirX: -1, dirY: -1, cursor: "nwse-resize" },
    { name: "n", hx: w / 2, hy: 0, dirX: 0, dirY: -1, cursor: "ns-resize" },
    { name: "ne", hx: w, hy: 0, dirX: 1, dirY: -1, cursor: "nesw-resize" },
    { name: "e", hx: w, hy: h / 2, dirX: 1, dirY: 0, cursor: "ew-resize" },
    { name: "se", hx: w, hy: h, dirX: 1, dirY: 1, cursor: "nwse-resize" },
    { name: "s", hx: w / 2, hy: h, dirX: 0, dirY: 1, cursor: "ns-resize" },
    { name: "sw", hx: 0, hy: h, dirX: -1, dirY: 1, cursor: "nesw-resize" },
    { name: "w", hx: 0, hy: h / 2, dirX: -1, dirY: 0, cursor: "ew-resize" },
  ];

  return (
    <>
      {/* Границы столбцов: тянется только выбранная граница, соседние столбцы
          обмениваются шириной, суммарная ширина таблицы не меняется. */}
      {colWs.map((_, c) => c === 0 ? null : (
        <DividerHandle
          key={`col-divider-${c}`}
          axis="x"
          pos={colX[c]}
          from={0}
          to={h}
          grip={grip}
          color={themeColors.selection}
          cursor="col-resize"
          onDrag={(p) => {
            const next = resizeTrackAt(colWs, c, snap(p));
            if (sameTracks(next, colWs)) return;
            updateElementVisual(elKey, { colWidths: next });
          }}
        />
      ))}

      {/* Границы строк: координата курсора приводится к телу таблицы (без шапки),
          но снапится ДО вычитания — линия должна лечь на сетку сцены, а не на
          сетку, сдвинутую на высоту шапки. */}
      {rowHs.map((_, r) => r === 0 ? null : (
        <DividerHandle
          key={`row-divider-${r}`}
          axis="y"
          pos={headerH + rowY[r]}
          from={0}
          to={w}
          grip={grip}
          color={themeColors.selection}
          cursor="row-resize"
          onDrag={(p) => {
            const next = resizeTrackAt(rowHs, r, snap(p) - headerH);
            if (sameTracks(next, rowHs)) return;
            updateElementVisual(elKey, { rowHeights: next });
          }}
        />
      ))}

      {/* Низ шапки. Верхняя граница — чтобы телу осталось по клетке на строку. */}
      {showHeader && (
        <DividerHandle
          axis="y"
          pos={headerH}
          from={0}
          to={w}
          grip={grip}
          color={themeColors.selection}
          cursor="row-resize"
          onDrag={(p) => {
            const max = h - rowHs.length * MIN_TRACK;
            const next = Math.min(Math.max(MIN_TRACK, snap(p)), Math.max(MIN_TRACK, max));
            if (next === headerH) return;
            updateElementVisual(elKey, { headerH: next });
          }}
        />
      )}

      {/* Габарит */}
      {box.map(b => (
        <BoxHandle
          key={`box-${b.name}`}
          hx={b.hx}
          hy={b.hy}
          size={size}
          strokeWidth={stroke}
          cursor={b.cursor}
          themeColors={themeColors}
          onDrag={(p) => {
            let nx = x, ny = y, nw = w, nh = h;

            if (b.dirX > 0) {
              nw = Math.max(MIN_SIZE, snap(p.x) - x);
            } else if (b.dirX < 0) {
              const right = x + w;
              nw = Math.max(MIN_SIZE, right - snap(p.x));
              nx = right - nw;
            }

            if (b.dirY > 0) {
              nh = Math.max(MIN_SIZE, snap(p.y) - y);
            } else if (b.dirY < 0) {
              const bottom = y + h;
              nh = Math.max(MIN_SIZE, bottom - snap(p.y));
              ny = bottom - nh;
            }

            if (nx === x && ny === y && nw === w && nh === h) return;
            updateElementVisual(elKey, { x: nx, y: ny, w: nw, h: nh });
          }}
        />
      ))}
    </>
  );
}

/**
 * Позиция курсора в системе координат `node`. Для ручки габарита это координаты
 * РОДИТЕЛЯ таблицы (там живут её x/y), для разделителя — координаты самой таблицы.
 */
function pointerIn(node: Konva.Node | null): { x: number; y: number } | null {
  return node?.getRelativePointerPosition() ?? null;
}

interface DividerHandleProps {
  axis: "x" | "y";
  /** Координата границы в системе координат таблицы. */
  pos: number;
  /** Протяжённость полосы захвата по второй оси. */
  from: number;
  to: number;
  grip: number;
  color: string;
  cursor: string;
  onDrag: (pointer: number) => void;
}

/** Полоса захвата на границе полос. Полупрозрачная — иначе её невозможно найти мышью. */
function DividerHandle({ axis, pos, from, to, grip, color, cursor, onDrag }: DividerHandleProps) {
  const ref = useRef<Konva.Rect>(null);

  const handleDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    // Родитель ручки — сама группа таблицы: её локальные координаты и есть система,
    // в которой заданы границы полос.
    const p = pointerIn(e.target.getParent());
    if (!p) return;
    onDrag(axis === "x" ? p.x : p.y);
  };

  return (
    <Rect
      ref={ref}
      // Имя обязательно: по нему Stage не начинает сессию мульти-перетаскивания.
      name="resize-handle"
      x={axis === "x" ? pos - grip / 2 : from}
      y={axis === "x" ? from : pos - grip / 2}
      width={axis === "x" ? grip : to - from}
      height={axis === "x" ? to - from : grip}
      fill={color}
      opacity={0.25}
      draggable
      // Узел остаётся на месте: его положение задаёт ре-рендер по новым размерам полос.
      dragBoundFunc={() => ref.current?.getAbsolutePosition() ?? { x: 0, y: 0 }}
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragMove={handleDrag}
      onDragEnd={handleDrag}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = cursor;
      }}
      onMouseLeave={(e) => resetCanvasCursor(e.target.getStage()?.container())}
    />
  );
}

interface BoxHandleProps {
  hx: number;
  hy: number;
  size: number;
  strokeWidth: number;
  cursor: string;
  themeColors: ThemeColors;
  onDrag: (pointer: { x: number; y: number }) => void;
}

/** Квадратная ручка габарита — вид тот же, что у ручки ширины текста. */
function BoxHandle({ hx, hy, size, strokeWidth, cursor, themeColors, onDrag }: BoxHandleProps) {
  const ref = useRef<Konva.Rect>(null);

  const handleDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    // Ручка → группа таблицы → её родитель: именно там заданы x/y таблицы.
    const p = pointerIn(e.target.getParent()?.getParent() ?? null);
    if (!p) return;
    onDrag(p);
  };

  return (
    <Rect
      ref={ref}
      name="resize-handle"
      x={hx}
      y={hy}
      width={size}
      height={size}
      offsetX={size / 2}
      offsetY={size / 2}
      fill={themeColors.handleFill}
      stroke={themeColors.selection}
      strokeWidth={strokeWidth}
      draggable
      dragBoundFunc={() => ref.current?.getAbsolutePosition() ?? { x: 0, y: 0 }}
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragMove={handleDrag}
      onDragEnd={handleDrag}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = cursor;
      }}
      onMouseLeave={(e) => resetCanvasCursor(e.target.getStage()?.container())}
    />
  );
}
