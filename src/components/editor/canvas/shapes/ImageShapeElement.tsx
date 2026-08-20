"use client";

import React from "react";
import { Group, Rect, Text, Image as KonvaImage } from "react-konva";
import { useImage } from "react-konva-utils";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import { pickImageFile, fitImageSize } from "@/lib/pickImageFile";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

/**
 * Картинка на холсте. src — data URL, выбранный через проводник (при дропе с
 * палитры или двойным кликом «заменить»). Ресайз/поворот — через SelectionTransformer
 * (image не входит в NON_TRANSFORMABLE). Вписывание задаётся objectFit:
 *  - contain — вписать целиком (по умолчанию), возможны поля;
 *  - cover   — заполнить рамку с обрезкой (через crop исходника);
 *  - fill    — растянуть по рамке.
 */
export function ImageShapeElement({ el, isSelected, onElementClick, updateElementVisual, stateId, runtime }: ShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;
  const w = rendered.w || 120;
  const h = rendered.h || 120;
  const src = rendered.src || "";
  const fit = rendered.objectFit || "contain";
  const [img] = useImage(src);

  // Геометрия отрисовки картинки внутри рамки w×h согласно objectFit.
  let draw = { x: 0, y: 0, w, h };
  let crop: { x: number; y: number; width: number; height: number } | undefined;
  if (img) {
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    if (fit === "contain") {
      const s = Math.min(w / iw, h / ih);
      const dw = iw * s, dh = ih * s;
      draw = { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
    } else if (fit === "cover") {
      // Рисуем на весь бокс, но обрезаем исходник до соотношения рамки.
      const s = Math.max(w / iw, h / ih);
      const cw = w / s, ch = h / s;
      crop = { x: (iw - cw) / 2, y: (ih - ch) / 2, width: cw, height: ch };
      draw = { x: 0, y: 0, w, h };
    }
    // fill — draw уже = вся рамка, crop не нужен (растяжение).
  }

  const replaceImage = async () => {
    const nextSrc = await pickImageFile();
    if (!nextSrc) return;
    const size = await fitImageSize(nextSrc, Math.max(w, h, 20) || 240);
    updateElementVisual(el.key, { src: nextSrc, w: size.w, h: size.h });
  };

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      rotation={rendered.rotate || 0}
      opacity={rendered.opacity ?? 1}
      draggable
      onDragEnd={(e) => updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
      onDblClick={(e) => { e.cancelBubble = true; void replaceImage(); }}
    >
      {isSelected && (
        <SelectionOutline x={-4} y={-4} width={w + 8} height={h + 8} />
      )}

      {/* Прозрачная область-хит: весь прямоугольник кликабелен/перетаскиваем,
          в т.ч. поля при objectFit=contain (сама картинка listening=false). */}
      <Rect x={0} y={0} width={w} height={h} fill="transparent" />

      {img ? (
        <KonvaImage
          image={img}
          x={draw.x} y={draw.y} width={draw.w} height={draw.h}
          crop={crop}
          listening={false}
        />
      ) : (
        <>
          <Rect
            x={0} y={0} width={w} height={h}
            fill="rgba(148,163,184,0.12)" stroke="#94a3b8" strokeWidth={1}
            dash={[6, 4]} cornerRadius={4} listening={false}
          />
          <Text
            x={0} y={0} width={w} height={h}
            text={src ? "Загрузка…" : "Картинка\n(двойной клик — выбрать)"}
            align="center" verticalAlign="middle"
            fill="#94a3b8" fontSize={12} listening={false}
          />
        </>
      )}
    </Group>
  );
}
