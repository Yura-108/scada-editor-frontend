"use client";

import React from "react";
import { Group, Rect } from "react-konva";
import { LeafElement, parseDashArray } from "@/core/scene";
import type { ShapeElementProps, ThemeColors } from "../types";
import { ShapeInscription } from "./ShapeInscription";

interface RectShapeElementProps extends ShapeElementProps {
  /** Вид элемента, уже посчитанный `ShapeElement` (состояние + рантайм). */
  rendered: LeafElement;
  themeColors: ThemeColors;
}

/** Прямоугольник — фигура по умолчанию для типов без своего компонента. */
export function RectShapeElement({ el, rendered, isSelected, onElementClick, updateElementVisual, themeColors }: RectShapeElementProps) {
  return (
    <Group
      key={el.key}
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      rotation={rendered.rotate || 0}
      draggable
      onDragEnd={(e) => {
        updateElementVisual(el.key, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
      }}
    >
      <Rect
        width={rendered.w}
        height={rendered.h}
        fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
        stroke={isSelected ? themeColors.selection : (rendered.strokeColor || themeColors.strokeDefault)}
        strokeWidth={isSelected ? 2 : (rendered.strokeWidth || 1)}
        dash={parseDashArray(rendered.strokeDasharray)}
        cornerRadius={rendered.rx || 0}
      />
      {/* Надпись читаем из `text`, а `label` оставляем запасным: в старых схемах
          подпись прямоугольника лежит именно в нём (а `label` — ещё и имя в «Слоях»). */}
      <ShapeInscription
        text={rendered.text || rendered.label || ""}
        w={rendered.w}
        h={rendered.h}
        inset={4}
        fontSize={rendered.fontSize ?? 14}
        fontFamily={rendered.fontFamily}
        bold={rendered.bold}
        color={rendered.textColor || themeColors.labelDefault}
      />

      {/* Ресайз/поворот одиночного выделения делает SelectionTransformer (Canvas). */}
    </Group>
  );
}
