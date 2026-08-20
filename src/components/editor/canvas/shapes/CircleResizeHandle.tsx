"use client";

import React, { useRef } from "react";
import { Circle } from "react-konva";
import Konva from "konva";
import { resetCanvasCursor } from "@/lib/editor/canvasCursor";
import { GRID } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";

interface CircleResizeHandleProps {
  /** Центр круга в координатах родителя (у элемента в модели лежит левый верхний угол габарита). */
  cx: number;
  cy: number;
  r: number;
  elKey: string;
  snap: (v: number) => number;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
  circleRef: React.RefObject<Konva.Circle | null>;
}

/**
 * Ручка радиуса: тянем вправо от центра, круг растёт вокруг ЦЕНТРА.
 *
 * Два правила, из-за которых ручка выглядит так, а не иначе:
 *
 *  1. **Центр неподвижен.** Раньше превью росло вокруг центра (императивный
 *     `radius()` у той же фигуры), а коммит писал только `radius/w/h`, оставляя
 *     `x, y` — левый верхний угол — на месте. То есть на отпускании центр прыгал
 *     вправо-вниз ровно на прирост радиуса. Теперь коммит сдвигает угол
 *     (`x = cx − r`), и картинка на отпускании не меняется вовсе.
 *  2. **Радиус привязан к сетке всё время жеста**, а не только в конце. Прежде
 *     круг плавно тянулся за курсором и на отпускании прыгал на ближайший узел;
 *     теперь он «щёлкает» по клеткам — та же обратная связь, что у ручек отрезка
 *     (`Anchor`) и ширины текста. Минимум — одна клетка.
 *
 * Радиус считается по горизонтали (`x − cx`), а не по расстоянию до курсора: ручка
 * зажата на горизонтальной оси, и от вертикального движения круг разъезжался, хотя
 * сама ручка стояла на месте.
 */
export function CircleResizeHandle({ cx, cy, r, elKey, snap, updateElementVisual, circleRef }: CircleResizeHandleProps) {
  const handleRef = useRef<Konva.Circle>(null);
  // Экранно-постоянный размер ручки (см. Anchor).
  const zoom = useEditorStore(s => s.camera.zoom);

  /** Радиус по позиции ручки: горизонталь от центра, шаг сетки, не меньше клетки. */
  const radiusAt = (handleX: number) => Math.max(GRID, snap(handleX - cx));

  /** Ставит ручку и фигуру в согласованное состояние — без ре-рендера React. */
  const applyRadius = (newR: number) => {
    handleRef.current?.position({ x: cx + newR, y: cy });
    circleRef.current?.radius(newR);
    circleRef.current?.getLayer()?.batchDraw();
  };

  return (
    <Circle
      ref={handleRef}
      name="resize-handle"
      x={cx + r}
      y={cy}
      radius={8 / zoom}
      fill="transparent"
      stroke="transparent"
      hitStrokeWidth={12 / zoom}
      draggable
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        applyRadius(radiusAt(e.target.x()));
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        const newR = radiusAt(e.target.x());
        // Ручка и фигура — в конечное состояние ДО коммита: React-ре-рендер придёт
        // с теми же числами, и визуального прыжка на отпускании нет.
        applyRadius(newR);
        if (newR === r) return;
        // `x, y` — левый верхний угол габарита: сдвигаем его так, чтобы центр остался
        // на месте. `w/h` держим равными диаметру — по ним считаются выделение,
        // рамка группы и «вписать в экран» (рендер берёт radius).
        updateElementVisual(elKey, {
          radius: newR,
          w: newR * 2,
          h: newR * 2,
          x: cx - newR,
          y: cy - newR,
        });
      }}
      onMouseEnter={e => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "ew-resize";
      }}
      onMouseLeave={e => {
        const container = e.target.getStage()?.container();
        resetCanvasCursor(container);
      }}
    />
  );
}
