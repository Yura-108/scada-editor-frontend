"use client";

import React, { useRef, useEffect, useState } from "react";
import { Group, Rect, Text } from "react-konva";
import Konva from "konva";
import { resetCanvasCursor } from "@/lib/editor/canvasCursor";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import { useEditorStore } from "@/store/useEditorStore";
import { MIN_SIZE } from "../types";
import type { ShapeElementProps } from "../types";
import { useThemeColors } from "../useThemeColors";
import { SelectionOutline } from "./SelectionOutline";

export function TextShapeElement({ el, isSelected, isEditing, snap, onElementClick, onStartTextEdit, updateElementVisual, stateId, runtime }: ShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;
  const textRef = useRef<Konva.Text>(null);
  // Через общий источник цветов холста, а не своим `resolvedTheme === "dark"`:
  // раньше здесь дублировалась палитра, а синий выделения был захардкожен.
  const { themeColors } = useThemeColors();
  const textDefaultColor = themeColors.textDefault;

  const pad = 4;

  const fontSize = rendered.fontSize ?? 16;
  const text = rendered.text ?? "Текст";
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
        // Позиция уже привязана общим обработчиком Stage (сетка + направляющие).
        updateElementVisual(el.key, {
          x: e.target.x(),
          y: e.target.y(),
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
        <SelectionOutline x={-pad} y={-pad} width={boxW + pad * 2} height={boxH + pad * 2} />
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
        <TextWidthHandle
          boxW={boxW}
          boxH={boxH}
          elKey={el.key}
          currentW={rendered.w}
          isAutoWidth={rendered.autoWidth !== false}
          snap={snap}
          updateElementVisual={updateElementVisual}
        />
      )}
    </Group>
  );
}

/**
 * Ручка ширины текста — отдельный компонент: локальная подписка на zoom даёт
 * экранно-постоянный размер, не ре-рендеря сам текст (ручка есть только у выделенного).
 */
function TextWidthHandle({ boxW, boxH, elKey, currentW, isAutoWidth, snap, updateElementVisual }: {
  boxW: number;
  boxH: number;
  elKey: string;
  currentW: number;
  isAutoWidth: boolean;
  snap: (v: number) => number;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
}) {
  const zoom = useEditorStore(s => s.camera.zoom);
  const { themeColors } = useThemeColors();
  const size = 8 / zoom;

  return (
    <Rect
      name="resize-handle"
      x={boxW}
      y={boxH / 2}
      width={size}
      height={size}
      offsetX={size / 2}
      offsetY={size / 2}
      fill={themeColors.handleFill}
      stroke={themeColors.selection}
      strokeWidth={1.5 / zoom}
      draggable
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragMove={(e) => {
        const nw = Math.max(MIN_SIZE, snap(e.target.x()));
        // Хендл держим на правом крае по центру высоты — «щёлкающая» обратная связь по сетке.
        e.target.position({ x: nw, y: boxH / 2 });
        // Растягивание => переход в режим фиксированной ширины (перенос по словам).
        // Пишем в стор только при смене снапнутого значения — не на каждый пиксель.
        if (nw !== currentW || isAutoWidth) {
          updateElementVisual(elKey, { w: nw, autoWidth: false });
        }
      }}
      onDblClick={(e) => {
        // Двойной клик по хендлу — вернуть ширину «по содержимому» (как в Figma).
        e.cancelBubble = true;
        updateElementVisual(elKey, { autoWidth: true });
      }}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "ew-resize";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        resetCanvasCursor(c);
      }}
    />
  );
}
