"use client";

import React from "react";
import { Text } from "react-konva";
import Konva from "konva";

/** Ниже этого кегля надпись всё равно нечитаема — лучше обрезать, чем сжимать дальше. */
const MIN_FONT_SIZE = 6;

interface ShapeInscriptionProps {
  text: string;
  /** Левый верхний угол габарита в координатах родительского узла Konva. */
  x?: number;
  y?: number;
  /** Габарит фигуры в её локальных координатах (надпись центрируется в нём). */
  w: number;
  h: number;
  /** Доля габарита, недоступная тексту с каждой стороны: у круга углы «съедены». */
  inset?: number;
  fontSize: number;
  fontFamily?: string;
  bold?: boolean;
  color: string;
  /** Ужимать кегль, пока строка не влезет по ширине. */
  autoFit?: boolean;
}

/**
 * Надпись внутри фигуры — по центру габарита.
 *
 * Зачем отдельным компонентом: на схемах обозначение устройства пишут прямо в круге,
 * и делать ради этого отдельный текстовый элемент, который придётся таскать следом за
 * фигурой, — ровно та работа, которую редактор должен снимать с человека. Надпись живёт
 * в поле `text` самой фигуры, поэтому едет, копируется, поворачивается и сохраняется
 * вместе с ней, а `label` остаётся именем элемента в панели «Слои».
 *
 * `autoFit` ужимает кегль под ширину: в круг Ø40 «COAG1V12» двенадцатым кеглем не лезет,
 * а руками подбирать размер для каждого устройства никто не станет.
 */
export function ShapeInscription({
  text,
  x = 0,
  y = 0,
  w,
  h,
  inset = 0,
  fontSize,
  fontFamily = "Arial",
  bold = false,
  color,
  autoFit = true,
}: ShapeInscriptionProps) {
  const available = Math.max(w - 2 * inset, 1);

  // Кегль подбираем измерением: Konva умеет только переносить и обрезать, а нам нужно
  // сжать. Узел временный — в сцену не попадает.
  const fitted = React.useMemo(() => {
    if (!autoFit || !text) return fontSize;
    const probe = new Konva.Text({ text, fontSize, fontFamily, fontStyle: bold ? "bold" : "normal" });
    const width = probe.getTextWidth();
    probe.destroy();
    if (width <= available) return fontSize;
    return Math.max(MIN_FONT_SIZE, Math.floor((fontSize * available) / width));
  }, [autoFit, text, fontSize, fontFamily, bold, available]);

  if (!text) return null;

  return (
    <Text
      // Не слушает события: клик по надписи должен выделять саму фигуру, а не проваливаться
      // мимо неё, и уж точно не мешать перетаскиванию.
      listening={false}
      x={x + inset}
      y={y}
      width={available}
      height={h}
      text={text}
      fontSize={fitted}
      fontFamily={fontFamily}
      fontStyle={bold ? "bold" : "normal"}
      fill={color}
      align="center"
      verticalAlign="middle"
      wrap="none"
      ellipsis
    />
  );
}
