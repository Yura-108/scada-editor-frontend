"use client";

import React from "react";
import { Group, Shape } from "react-konva";
import Konva from "konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import { parseDashArray } from "@/lib/editor/dashArray";
import { GRID } from "@/lib/utils";
import type { ShapeElementProps } from "../types";
import { useThemeColors } from "../useThemeColors";
import { Anchor } from "./Anchor";
import { SelectionOutline } from "./SelectionOutline";

/**
 * Шаг привязки углов, °.
 *
 * Сетка холста к углам неприменима, но «липкость» нужна та же: 5° делит и 90, и 45,
 * и 30, и 15 — ходовые дуги ложатся точно, а не в 89.7°.
 */
const ANGLE_STEP = 5;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Угол в [0, 360). */
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

/** Раствор в (0, 360]: дуги нулевого раствора не бывает, полный круг — это 360. */
const normSweep = (deg: number) => norm360(deg) || 360;

const snapAngle = (deg: number) => norm360(Math.round(deg / ANGLE_STEP) * ANGLE_STEP);

/**
 * Дуга окружности: внешний радиус, начало и раствор в градусах, опционально
 * внутренний радиус (кольцевой сегмент) или замыкание радиусами (сектор).
 *
 * **Точки привязки.** В модели `x, y` — левый верхний угол описанного квадрата
 * `2r × 2r`, как у круга: по нему считаются выделение, рамка группы и «вписать
 * в экран», и он же снапится к сетке при перетаскивании (при радиусе, кратном 20,
 * центр тоже оказывается в узле). Габарит намеренно берётся от полной окружности,
 * а не от видимого куска дуги: иначе рамка выделения дёргалась бы при каждом
 * изменении раствора, а элемент «уползал» бы от собственных координат.
 *
 * **Начало дуги живёт в общем поле `rotate`.** Своего `rotation` у фигуры нет:
 * поворот дуги — это и есть её начальный угол, второе такое поле было бы двумя
 * источниками истины. Поэтому `arc` не входит в `ROTATABLE_TYPES` — «Поворот°»
 * панели заменён на «Начало, °» в блоке «Геометрия».
 *
 * Ручки (видны при выделении): начало дуги, конец (раствор) и радиус — последняя
 * сидит на биссектрисе раствора, чтобы не слипаться с двумя первыми.
 */
export function ArcShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual, stateId, runtime }: ShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;
  const { themeColors } = useThemeColors();

  const radius = Math.max(GRID, rendered.radius ?? (rendered.w || 2 * GRID) / 2);
  const innerRadius = Math.min(Math.max(rendered.innerRadius ?? 0, 0), radius);
  const start = norm360(rendered.rotate ?? 0);
  const sweep = normSweep(rendered.angle ?? 90);
  const closed = rendered.arcClosed === true;

  /** Кольцевой сегмент и сектор — замкнутые фигуры, их есть чем заливать; голая дуга — нет. */
  const isBand = innerRadius > 0;
  const isFilled = isBand || closed;

  // Центр в координатах родителя — для коммитов, меняющих радиус: он должен
  // остаться на месте (растём во все стороны, как ручка радиуса у круга).
  const cx = rendered.x + radius;
  const cy = rendered.y + radius;

  const strokeWidth = rendered.strokeWidth ?? 2;

  const sceneFunc = (ctx: Konva.Context, shape: Konva.Shape) => {
    const a0 = toRad(start);
    const a1 = toRad(start + sweep);

    ctx.beginPath();
    if (isBand) {
      ctx.arc(0, 0, radius, a0, a1, false);
      ctx.arc(0, 0, innerRadius, a1, a0, true);
      ctx.closePath();
    } else if (closed) {
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, a0, a1, false);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, radius, a0, a1, false);
    }

    // Незамкнутую дугу только обводим: заливка достроила бы хорду и превратила
    // линию в сегмент. Она же попадает на hit-канву — попасть по дуге можно
    // строго по её толщине (плюс hitStrokeWidth), а не по всему квадрату.
    if (isFilled) ctx.fillStrokeShape(shape);
    else ctx.strokeShape(shape);
  };

  /** Точка на угле `deg` и радиусе `r` в координатах группы (центр — (radius, radius)). */
  const pointAt = (deg: number, r: number) => ({
    x: radius + r * Math.cos(toRad(deg)),
    y: radius + r * Math.sin(toRad(deg)),
  });

  /** Угол ручки относительно центра, привязанный к шагу. */
  const angleOf = (localX: number, localY: number) =>
    snapAngle((Math.atan2(localY - radius, localX - radius) * 180) / Math.PI);

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => {
        // Ручки тоже draggable, и их dragend всплывает сюда: без этой проверки
        // локальная координата ручки уехала бы в позицию всего элемента.
        if (e.target !== e.currentTarget) return;
        // Позиция уже привязана к сетке общим обработчиком Stage.
        updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() });
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
      }}
    >
      {isSelected && (
        <SelectionOutline x={0} y={0} width={2 * radius} height={2 * radius} />
      )}

      <Shape
        x={radius}
        y={radius}
        sceneFunc={sceneFunc}
        fill={isFilled ? (rendered.color || rendered.bg || "transparent") : undefined}
        stroke={isSelected ? themeColors.selection : (rendered.strokeColor || themeColors.strokeDefault)}
        strokeWidth={strokeWidth}
        dash={parseDashArray(rendered.strokeDasharray)}
        hitStrokeWidth={Math.max(12, strokeWidth)}
      />

      {isSelected && (
        <>
          {/* Начало дуги: конец остаётся на месте, меняются и начало, и раствор. */}
          <Anchor
            key={`${el.key}-arc-start`}
            {...pointAt(start, radius)}
            themeColors={themeColors}
            onDragMove={(e) => {
              const a = angleOf(e.target.x(), e.target.y());
              const nextSweep = normSweep(start + sweep - a);
              e.target.position(pointAt(a, radius));
              // В стор пишем только при переходе через шаг привязки.
              if (a !== start || nextSweep !== sweep) {
                updateElementVisual(el.key, { rotate: a, angle: nextSweep });
              }
            }}
          />

          {/* Конец дуги: начало на месте, меняется раствор. */}
          <Anchor
            key={`${el.key}-arc-end`}
            {...pointAt(start + sweep, radius)}
            themeColors={themeColors}
            onDragMove={(e) => {
              const a = angleOf(e.target.x(), e.target.y());
              const nextSweep = normSweep(a - start);
              e.target.position(pointAt(a, radius));
              if (nextSweep !== sweep) updateElementVisual(el.key, { angle: nextSweep });
            }}
          />

          {/* Радиус: на биссектрисе раствора, шаг сетки, центр остаётся на месте. */}
          <Anchor
            key={`${el.key}-arc-radius`}
            {...pointAt(start + sweep / 2, radius)}
            themeColors={themeColors}
            onDragMove={(e) => {
              const dx = e.target.x() - radius;
              const dy = e.target.y() - radius;
              const nr = Math.max(GRID, snap(Math.hypot(dx, dy)));
              e.target.position(pointAt(start + sweep / 2, nr));
              if (nr !== radius) {
                updateElementVisual(el.key, {
                  radius: nr,
                  w: 2 * nr,
                  h: 2 * nr,
                  x: cx - nr,
                  y: cy - nr,
                  // Кольцо не должно вывернуться наизнанку при сжатии.
                  ...(innerRadius > nr ? { innerRadius: nr } : {}),
                });
              }
            }}
          />
        </>
      )}
    </Group>
  );
}
