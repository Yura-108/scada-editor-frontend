"use client";

import React from "react";
import { Group, Circle } from "react-konva";
import Konva from "konva";
import { LeafElement } from "@/core/scene";
import type { ShapeElementProps, ThemeColors } from "../types";
import { CircleResizeHandle } from "./CircleResizeHandle";
import { ShapeInscription } from "./ShapeInscription";

interface CircleShapeElementProps extends ShapeElementProps {
  /** Вид элемента, уже посчитанный `ShapeElement` (состояние + рантайм). */
  rendered: LeafElement;
  themeColors: ThemeColors;
}

/** Круг: центр тянется, радиус — ручкой, надпись внутри правится двойным кликом. */
export function CircleShapeElement({ el, rendered, isSelected, isEditing, snap, onElementClick, onStartTextEdit, updateElementVisual, themeColors }: CircleShapeElementProps) {
  // Раньше в ветке круга вызывался React.createRef() прямо в рендере: он создаёт
  // НОВЫЙ ref на каждый рендер, и CircleResizeHandle мог получить отцепленный.
  const circleRef = React.useRef<Konva.Circle>(null);
  const r = rendered.radius || rendered.w / 2 || 40;
  const cx = rendered.x + r;
  const cy = rendered.y + r;
  return (
    <Group key={el.key} id={el.key}>
      <Circle
        ref={circleRef}
        x={cx}
        y={cy}
        radius={r}
        fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
        stroke={isSelected ? themeColors.selection : (rendered.strokeColor || themeColors.strokeDefault)}
        strokeWidth={isSelected ? 3 : (rendered.strokeWidth || 2)}
        draggable
        onDragEnd={(e) => {
          // Позиция узла круга — это его ЦЕНТР, и он уже привязан к сетке общим
          // обработчиком Stage (useMultiDragAndGuides). В модели у элемента лежит
          // левый верхний угол габарита, поэтому вычитаем радиус.
          const nx = e.target.x();
          const ny = e.target.y();
          e.target.position({ x: cx, y: cy });
          updateElementVisual(el.key, { x: nx - r, y: ny - r });
        }}
        onClick={(e) => {
          e.cancelBubble = true;
          onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
        }}
        onDblClick={(e) => {
          // Тот же жест, что у текстового элемента: двойной клик — правка надписи
          // на месте. Оверлей пишет в `text`, то есть ровно в то поле, что рисуется ниже.
          e.cancelBubble = true;
          onStartTextEdit?.(el.key);
        }}
        onDblTap={(e) => {
          e.cancelBubble = true;
          onStartTextEdit?.(el.key);
        }}
      />
      {/* Надпись внутри круга: на схемах обозначение устройства пишут прямо в нём.
          `inset` в 15% диаметра — примерно вписанный в окружность квадрат, иначе длинная
          строка вылезала бы за края там, где круг уже сузился. */}
      <ShapeInscription
        text={isEditing ? "" : (rendered.text ?? "")}
        x={rendered.x}
        y={rendered.y}
        w={2 * r}
        h={2 * r}
        inset={0.15 * 2 * r}
        fontSize={rendered.fontSize ?? 14}
        fontFamily={rendered.fontFamily}
        bold={rendered.bold}
        color={rendered.textColor || themeColors.labelDefault}
      />
      {isSelected && (
        <CircleResizeHandle
          key={`${el.key}-resize`}
          cx={cx}
          cy={cy}
          r={r}
          elKey={el.key}
          snap={snap}
          updateElementVisual={updateElementVisual}
          circleRef={circleRef}
        />
      )}
    </Group>
  );
}
