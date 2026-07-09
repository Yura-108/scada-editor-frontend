"use client";

import React, { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Group, Rect, Text } from "react-konva";
import Konva from "konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";

export function TextShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const textRef = useRef<Konva.Text>(null);
  const { resolvedTheme } = useTheme();
  const textDefaultColor = resolvedTheme === "dark" ? "#ffffff" : "#1a1a1a";

  const pad = 4;

  const fontSize = rendered.fontSize ?? 16;
  const text = rendered.text ?? "Text";
  const fontFamily = rendered.fontFamily || "Arial";
  const fontStyle = rendered.bold ? "bold" : "normal";

  // Измеряем реальный размер текста. Инициализируем через временный узел,
  // затем обновляем по реальному узлу после каждого рендера Konva.
  const [selDims, setSelDims] = useState<{ w: number; h: number }>(() => {
    const tmp = new Konva.Text({ text, fontSize, fontFamily, fontStyle, width: rendered.w || undefined });
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
  }, [text, fontSize, fontFamily, fontStyle, rendered.w]);

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => {
        updateElementVisual(el.key, {
          x: snap(e.target.x()),
          y: snap(e.target.y()),
        });
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
      }}
    >
      {isSelected && (
        <Rect
          x={-pad}
          y={-pad}
          width={selDims.w + pad * 2}
          height={selDims.h + pad * 2}
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
        width={rendered.w || undefined}
        listening={true}
      />
    </Group>
  );
}
