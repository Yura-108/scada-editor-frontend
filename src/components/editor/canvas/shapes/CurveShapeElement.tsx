"use client";

import React from "react";
import { Group, Arrow, Line } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import { parseDashArray } from "@/lib/editor/dashArray";
import { parseCurvePoints, CURVE_POINTS_LENGTH, curvePointsBounds } from "@/lib/editor/curvePoints";
import type { ShapeElementProps } from "../types";
import { useThemeColors } from "../useThemeColors";
import { Anchor } from "./Anchor";

/**
 * Кривая линия — кубическая кривая Безье: два конца и две направляющие точки.
 *
 * От дуги (`arc`) отличается смыслом: та живёт на окружности и задаётся радиусом
 * с углами, а эта гнётся куда угодно — от почти прямой до S-образной. Отсюда и
 * разные ручки: у дуги начало/раствор/радиус, здесь — четыре точки.
 *
 * **Геометрия — в `points`, как у полигона:** `[x0,y0, c1x,c1y, c2x,c2y, x1,y1]`
 * ЛОКАЛЬНО относительно `x, y` элемента. Поэтому перетаскивание всей кривой меняет
 * только `x, y` (точки не трогаются), а копирование и вставка работают штатным
 * сдвигом. `w/h` держим равными габариту точек: по ним считаются выделение рамкой,
 * рамка группы-предка и «вписать в экран».
 *
 * Рисуется `Konva.Arrow` с `bezier`: наконечники стрелок он строит по касательной
 * в конце (последняя направляющая → конец), то есть на кривой они смотрят верно.
 */
export function CurveShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual, stateId, runtime }: ShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;
  const { themeColors } = useThemeColors();

  const pts = parseCurvePoints(rendered.points);
  const strokeWidth = rendered.strokeWidth || 2;
  const stroke = isSelected ? themeColors.selection : (rendered.strokeColor || themeColors.strokeDefault);

  /**
   * Двигает одну точку и синхронно пересчитывает `x/y/w/h`.
   *
   * Габарит обязан ехать вместе с точками, иначе рамка выделения и группа-предок
   * останутся от прошлой формы. Начало координат при этом держим в левом верхнем
   * углу габарита: если точку утащили влево-вверх, сдвигаем `x, y` и переносим
   * ВСЕ точки на ту же величину — форма на холсте не меняется.
   */
  const movePoint = (index: number, nx: number, ny: number) => {
    const next = [...pts];
    next[index * 2] = nx;
    next[index * 2 + 1] = ny;

    const b = curvePointsBounds(next);
    const shifted = next.map((v, i) => (i % 2 === 0 ? v - b.minX : v - b.minY));

    updateElementVisual(el.key, {
      points: shifted,
      x: rendered.x + b.minX,
      y: rendered.y + b.minY,
      w: Math.max(b.maxX - b.minX, 1),
      h: Math.max(b.maxY - b.minY, 1),
    });
  };

  /** Ручка точки: снап к сетке и запись в стор только при переходе через её шаг. */
  const pointAnchor = (index: number) => (
    <Anchor
      key={`${el.key}-curve-${index}`}
      x={pts[index * 2]}
      y={pts[index * 2 + 1]}
      themeColors={themeColors}
      onDragMove={(e) => {
        const sx = snap(e.target.x());
        const sy = snap(e.target.y());
        e.target.position({ x: sx, y: sy });
        if (sx !== pts[index * 2] || sy !== pts[index * 2 + 1]) movePoint(index, sx, sy);
      }}
    />
  );

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => {
        // Ручки точек — draggable-дети, их dragend всплывает сюда.
        if (e.target !== e.currentTarget) return;
        // Позиция уже привязана к сетке общим обработчиком Stage.
        updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() });
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
      }}
    >
      <Arrow
        points={pts}
        bezier
        stroke={stroke}
        fill={stroke}
        strokeWidth={strokeWidth}
        dash={parseDashArray(rendered.strokeDasharray)}
        pointerAtBeginning={!!rendered.arrowStart}
        pointerAtEnding={!!rendered.arrowEnd}
        pointerLength={Math.max(8, strokeWidth * 2.5)}
        pointerWidth={Math.max(7, strokeWidth * 2.2)}
        hitStrokeWidth={Math.max(12, strokeWidth)}
      />

      {isSelected && (
        <>
          {/* Поводки от концов к своим направляющим — иначе непонятно, что чем гнётся. */}
          <Line
            points={[pts[0], pts[1], pts[2], pts[3]]}
            stroke={themeColors.selection}
            strokeWidth={1}
            dash={[4, 3]}
            listening={false}
          />
          <Line
            points={[pts[CURVE_POINTS_LENGTH - 2], pts[CURVE_POINTS_LENGTH - 1], pts[4], pts[5]]}
            stroke={themeColors.selection}
            strokeWidth={1}
            dash={[4, 3]}
            listening={false}
          />
          {[0, 1, 2, 3].map(pointAnchor)}
        </>
      )}
    </Group>
  );
}
