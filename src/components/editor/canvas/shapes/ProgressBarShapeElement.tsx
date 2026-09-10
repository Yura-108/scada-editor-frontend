"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Group, Rect, Text } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

/** Длительность доводки заполнения до нового значения. */
const FILL_ANIM_MS = 400;

/**
 * Скачок, ниже которого анимация не нужна.
 *
 * Телеметрия шумит: у аналогового тега значение дрожит на десятых долях процента каждый
 * кадр. Анимировать такое — значит держать постоянную перерисовку холста ради невидимого
 * глазу движения.
 */
const FILL_ANIM_EPSILON = 0.5;

/**
 * Плавная доводка значения.
 *
 * Считаем в React, а не Konva-твином: заполнение рисуется двумя разными прямоугольниками
 * (вертикальный растёт снизу вверх, то есть у него меняется ещё и `y`), плюс от значения
 * зависит скругление угла и подпись. Твин по одному узлу всё это не покрыл бы.
 */
function useAnimatedValue(target: number): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Микроскачки применяем мгновенно — см. FILL_ANIM_EPSILON.
    if (Math.abs(target - shown) < FILL_ANIM_EPSILON) {
      if (shown !== target) setShown(target);
      return;
    }

    fromRef.current = shown;
    startRef.current = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / FILL_ANIM_MS);
      // easeOutCubic: быстрый старт и мягкая остановка — движение читается как «дошло»,
      // а не как «дёрнулось».
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(fromRef.current + (target - fromRef.current) * eased);
      rafRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // `shown` намеренно не в зависимостях: он меняется каждым кадром и перезапускал бы
    // анимацию сам на себя. Цель анимации — только `target`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return shown;
}

/** Число из значения тега: с провода оно приходит строкой. */
const toPercent = (raw: unknown): number => {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim().replace(",", "."));
  // Значение тега берётся как проценты 0–100 и просто ограничивается по краям.
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
};

export function ProgressBarShapeElement({ el, isSelected, onElementClick, updateElementVisual, stateId, runtime }: ShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const pad = 4;
  const w = rendered.w || 200;
  const h = rendered.h || 20;

  /**
   * Значение. В мониторе сюда приезжает живое значение тега: прямая привязка
   * (`direct` + `tag`) кладёт его в рантайм-оверрайд `value` без исполнения кода —
   * см. bindingIndex.ts. В редакторе это просто поле элемента.
   */
  const value = useAnimatedValue(toPercent(rendered.value));
  const isVertical = rendered.orientation === "vertical";

  const trackColor = rendered.backgroundColor || rendered.bg || (isDark ? "#3f3f46" : "#e5e7eb");
  const fillColor = rendered.color || "#3b82f6";
  const textCol = rendered.textColor || "#ffffff";
  const strokeCol = rendered.strokeColor;
  const showPct = rendered.showPercentage !== false;

  const length = isVertical ? h : w;
  const thickness = isVertical ? w : h;
  const fillLength = (length * value) / 100;
  const fillFull = fillLength >= length - 0.5;
  const r = Math.min(4, thickness / 2);

  const pct = `${Math.round(value)}%`;
  const labelText = (rendered.label ?? "").toString().trim();
  const displayText = showPct ? (labelText ? `${labelText} ${pct}` : pct) : labelText;

  // Уменьшили размер шрифта и высоту бокса текста, чтобы текст гарантированно помещался внутри бара
  const textBoxHeight = Math.max(8, Math.floor(thickness * 0.78));
  const fontSize = Math.max(9, Math.floor(textBoxHeight * 0.78));
  const showText = !!displayText && thickness >= 12;

  const fillRadius = fillFull
    ? r
    : isVertical
      ? [0, 0, r, r]
      : [r, 0, 0, r];

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      rotation={rendered.rotate || 0}
      draggable
      onDragEnd={(e) => updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <SelectionOutline x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} />
      )}

      {/* Трек (фон) */}
      <Rect x={0} y={0} width={w} height={h} fill={trackColor} cornerRadius={r} />

      {/* Заполнение. Вертикальный растёт снизу вверх — у него меняется и `y`. */}
      {fillLength > 0 && (
        isVertical ? (
          <Rect x={0} y={h - fillLength} width={w} height={fillLength} fill={fillColor} cornerRadius={fillRadius} />
        ) : (
          <Rect x={0} y={0} width={fillLength} height={h} fill={fillColor} cornerRadius={fillRadius} />
        )
      )}

      {/* Рамка */}
      {strokeCol && (
        <Rect
          x={0} y={0} width={w} height={h}
          fill="transparent" stroke={strokeCol} strokeWidth={rendered.strokeWidth ?? 1}
          cornerRadius={r} listening={false}
        />
      )}

      {/* Текст */}
      {showText && (
        <Group
          x={w / 2}
          y={h / 2}
          rotation={isVertical ? -90 : 0}
          listening={false}
        >
          <Text
            x={-length / 2}
            y={-textBoxHeight / 2}
            width={length}
            height={textBoxHeight}
            text={displayText}
            fontSize={fontSize}
            fill={textCol}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
