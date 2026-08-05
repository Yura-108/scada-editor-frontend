"use client";

import React from "react";
import { Group, Rect, Circle, Text } from "react-konva";
import { DiagramElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { getAbsoluteRenderedPos } from "@/lib/editor/getAbsoluteRenderedPos";
import { getElementBoundsRendered } from "@/lib/getElementBounds";

interface NoDataOverlayProps {
  noDataElementKeys: Set<string>;
  elements: DiagramElement[];
  elementsMap: Record<string, DiagramElement>;
}

const BADGE_RADIUS = 9;

/**
 * Оверлей «нет данных» (TAG_CONTRACT_CHANGES.md B2): приглушает компонент,
 * привязанный к тегу с quality != GOOD (или ещё не получавший ни одного
 * сообщения — B4), и рисует бейдж-«?» в углу его bounding box. Рисуется
 * отдельным слоем поверх готовой сцены — ShapeElement/GroupNode не меняются,
 * оверлей не зависит от того, что насчитал сам биндинг компонента.
 */
export function NoDataOverlay({ noDataElementKeys, elements, elementsMap }: NoDataOverlayProps) {
  if (!noDataElementKeys.size) return null;

  return (
    <>
      {[...noDataElementKeys].map(key => {
        const el = elementsMap[key];
        if (!el) return null;

        let bounds: { x: number; y: number; w: number; h: number };
        if (el.type === "group") {
          const abs = getAbsoluteRenderedPos(el, elementsMap);
          const rendered = getRenderedElement(el);
          bounds = { x: abs.x, y: abs.y, w: rendered.w ?? 0, h: rendered.h ?? 0 };
        } else {
          const b = getElementBoundsRendered(el, elements);
          bounds = { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
        }
        if (!bounds.w && !bounds.h) return null;

        return (
          <Group key={`no-data-${key}`} listening={false}>
            <Rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.w}
              height={bounds.h}
              fill="rgba(120,120,120,0.45)"
              cornerRadius={2}
            />
            <Circle
              x={bounds.x + bounds.w - BADGE_RADIUS}
              y={bounds.y - BADGE_RADIUS + 2}
              radius={BADGE_RADIUS}
              fill="#78716c"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <Text
              x={bounds.x + bounds.w - BADGE_RADIUS * 2}
              y={bounds.y - BADGE_RADIUS - 4}
              width={BADGE_RADIUS * 2}
              height={BADGE_RADIUS * 2}
              text="?"
              fontSize={12}
              fontStyle="bold"
              fill="#ffffff"
              align="center"
              verticalAlign="middle"
            />
          </Group>
        );
      })}
    </>
  );
}
