"use client";

import React, { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Group, Rect, Text } from "react-konva";
import Konva from "konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { MIN_SIZE } from "../types";
import type { ShapeElementProps } from "../types";

export function TextShapeElement({ el, isSelected, isEditing, snap, onElementClick, onStartTextEdit, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const textRef = useRef<Konva.Text>(null);
  const { resolvedTheme } = useTheme();
  const textDefaultColor = resolvedTheme === "dark" ? "#ffffff" : "#1a1a1a";

  const pad = 4;

  const fontSize = rendered.fontSize ?? 16;
  const text = rendered.text ?? "Text";
  const fontFamily = rendered.fontFamily || "Arial";
  const fontStyle = rendered.bold ? "bold" : "normal";
  // Режим ширины (как в Figma): по умолчанию — по содержимому (перенос только по Enter);
  // после растягивания (autoWidth === false) — фиксированная ширина `w` с переносом по словам.
  const isFixedWidth = rendered.autoWidth === false && !!rendered.w;
  const width = isFixedWidth ? rendered.w : undefined;

  // Измеряем реальный размер текста. Инициализируем через временный узел,
  // затем обновляем по реальному узлу после каждого рендера Konva.
  const [selDims, setSelDims] = useState<{ w: number; h: number }>(() => {
    const tmp = new Konva.Text({ text, fontSize, fontFamily, fontStyle, width });
    const dims = { w: tmp.getTextWidth(), h: tmp.height() };
    tmp.destroy();
    return dims;
  });

  useEffect(() => {
    if (textRef.current) {
      setSelDims({
        w: textRef.current.getTextWidth(),
        h: textRef.current.height(),
      });
    }
  }, [text, fontSize, fontFamily, fontStyle, width]);

  // Габариты рамки: при фикс. ширине берём её, иначе — измеренную ширину текста.
  const boxW = Math.max(width ?? selDims.w, 1);
  const boxH = Math.max(selDims.h, 1);

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => {
        // Игнорируем всплывший dragend от дочерней ручки ресайза — иначе её локальный x()
        // (равный новой ширине) запишется как координата группы и текст «телепортируется».
        if (e.target !== e.currentTarget) return;
        updateElementVisual(el.key, {
          x: snap(e.target.x()),
          y: snap(e.target.y()),
        });
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        onStartTextEdit?.(el.key);
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        onStartTextEdit?.(el.key);
      }}
    >
      {isSelected && !isEditing && (
        <Rect
          x={-pad}
          y={-pad}
          width={boxW + pad * 2}
          height={boxH + pad * 2}
          fill="transparent"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dash={[4, 3]}
          listening={false}
        />
      )}
      <Text
        ref={textRef}
        x={0}
        y={0}
        text={text}
        fontSize={fontSize}
        fontStyle={fontStyle}
        fontFamily={fontFamily}
        fill={rendered.color || rendered.textColor || textDefaultColor}
        align={rendered.align || "left"}
        width={width}
        visible={!isEditing}
        listening={true}
      />

      {/* Ручка растягивания ширины (как в Figma — тянем правый край, текст переносится по словам). */}
      {isSelected && !isEditing && (
        <Rect
          x={boxW}
          y={boxH / 2}
          width={8}
          height={8}
          offsetX={4}
          offsetY={4}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={1.5}
          draggable
          onDragStart={(e) => { e.cancelBubble = true; }}
          onDragMove={(e) => {
            const nw = Math.max(MIN_SIZE, snap(e.target.x()));
            // Хендл держим на правом крае по центру высоты — «щёлкающая» обратная связь по сетке.
            e.target.position({ x: nw, y: boxH / 2 });
            // Растягивание => переход в режим фиксированной ширины (перенос по словам).
            updateElementVisual(el.key, { w: nw, autoWidth: false });
          }}
          onDblClick={(e) => {
            // Двойной клик по хендлу — вернуть ширину «по содержимому» (как в Figma).
            e.cancelBubble = true;
            updateElementVisual(el.key, { autoWidth: true });
          }}
          onMouseEnter={(e) => {
            const c = e.target.getStage()?.container();
            if (c) c.style.cursor = "ew-resize";
          }}
          onMouseLeave={(e) => {
            const c = e.target.getStage()?.container();
            if (c) c.style.cursor = "default";
          }}
        />
      )}
    </Group>
  );
}
