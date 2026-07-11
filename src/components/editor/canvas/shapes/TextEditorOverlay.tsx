"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { getAbsoluteRenderedPos } from "@/lib/editor/getAbsoluteRenderedPos";
import { DiagramElement, LeafElement } from "@/types/editorElement.type";

interface TextEditorOverlayProps {
  elementKey: string;
  elementsMap: Record<string, DiagramElement>;
  onClose: () => void;
}

/**
 * HTML-<textarea> поверх холста для инлайн-редактирования текстового элемента (как в Figma):
 * Enter — перенос строки, Esc / потеря фокуса — сохранение. Позиция считается из store
 * (мировые координаты + камера), поэтому корректно учитывает зум и панораму.
 */
export function TextEditorOverlay({ elementKey, elementsMap, onClose }: TextEditorOverlayProps) {
  const element = useEditorStore((s) => s.elements.find((e) => e.key === elementKey));
  const camera = useEditorStore((s) => s.camera);
  const updateElementVisual = useEditorStore((s) => s.updateElementVisual);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const rendered = element ? (getRenderedElement(element) as LeafElement) : null;

  const [value, setValue] = useState<string>(rendered?.text ?? "Text");

  // Фокус + выделение всего текста при открытии — сразу можно перепечатать.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.select();
  }, []);

  const isFixedWidth = rendered?.autoWidth === false && !!rendered?.w;

  // Автоподгон размеров textarea под содержимое (высота всегда, ширина — только в авто-режиме).
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
    if (!isFixedWidth) {
      ta.style.width = "auto";
      ta.style.width = `${ta.scrollWidth + 2}px`;
    }
  }, [value, camera.zoom, isFixedWidth]);

  if (!element || !rendered) return null;

  // Экранная позиция (в координатах контейнера холста) = камера + мировая позиция * зум.
  const world = getAbsoluteRenderedPos(element, elementsMap);
  const zoom = camera.zoom;
  const left = camera.x + world.x * zoom;
  const top = camera.y + world.y * zoom;
  const fontSize = (rendered.fontSize ?? 16) * zoom;
  const fixedWidth = isFixedWidth && rendered.w ? rendered.w * zoom : undefined;

  const commit = () => {
    // Пустой текст не сохраняем — элемент остаётся с прежним значением (чтобы не «потерять» его на холсте).
    if (value.trim().length === 0) {
      onClose();
      return;
    }
    if (value !== rendered.text) updateElementVisual(elementKey, { text: value });
    onClose();
  };

  return (
    <textarea
      ref={taRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        // Гасим всплытие, чтобы глобальные хоткеи редактора не срабатывали во время набора.
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          commit();
        }
        // Enter — перенос строки (стандартное поведение textarea), как в Figma.
      }}
      spellCheck={false}
      wrap={isFixedWidth ? "soft" : "off"}
      style={{
        position: "absolute",
        left,
        top,
        zIndex: 20,
        margin: 0,
        padding: 0,
        border: "none",
        outline: "none",
        boxShadow: "0 0 0 1px #3b82f6",
        background: "transparent",
        resize: "none",
        overflow: "hidden",
        color: rendered.color || rendered.textColor || "inherit",
        fontFamily: rendered.fontFamily || "Arial",
        fontSize: `${fontSize}px`,
        fontWeight: rendered.bold ? "bold" : "normal",
        lineHeight: 1,
        textAlign: (rendered.align as React.CSSProperties["textAlign"]) || "left",
        width: fixedWidth ? `${fixedWidth}px` : "auto",
        whiteSpace: isFixedWidth ? "pre-wrap" : "pre",
        boxSizing: "content-box",
      }}
    />
  );
}
