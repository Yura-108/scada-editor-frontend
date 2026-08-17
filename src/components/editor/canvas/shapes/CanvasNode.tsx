"use client";

import React from "react";
import { Group, Rect } from "react-konva";
import Konva from "konva";
import { resetCanvasCursor } from "@/lib/editor/canvasCursor";
import { GroupElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { EditorRenderContext } from "../types";
import { useElementRenderState } from "../useElementRenderState";
import { ShapeElement } from "./ShapeElement";

interface CanvasNodeProps {
  /** Ключ элемента. Сам элемент узел достаёт из стора — см. useElementRenderState. */
  elementKey: string;
  ctx: EditorRenderContext;
}

/**
 * Узел холста: подписывается на свой элемент и рисует его — фигуру или группу.
 *
 * Узлы адресуются КЛЮЧОМ, а не объектом элемента. Благодаря этому родитель не
 * перерисовывает детей, когда меняется он сам: каждый узел независимо следит за
 * своим срезом стора. Раньше вся сцена ехала одним объектом-контекстом из
 * Canvas, и перетаскивание одной фигуры реконсилировало все N узлов.
 */
function CanvasNodeBase({ elementKey, ctx }: CanvasNodeProps) {
  const state = useElementRenderState(elementKey);
  const el = state.el;

  // Элемент удалён (или ещё не подгружен) — рисовать нечего.
  if (!el) return null;

  if (el.type === "group") {
    return <GroupNode group={el as GroupElement} ctx={ctx} state={state} />;
  }

  return (
    <ShapeElement
      el={el}
      ctx={ctx}
      // Когда к фигуре прицеплен Transformer, его рамка заменяет собственную
      // пунктирную рамку (двойная рамка выглядит грязно).
      isSelected={state.isSelected && !state.isTransformerTarget}
      isEditing={state.isEditing}
      focusedCell={state.focusedCell}
    />
  );
}

/**
 * Мемоизировано: пропы — строка и стабильный ctx, поэтому родительский ре-рендер
 * узел не задевает. Всё изменчивое приходит через собственную подписку.
 */
export const CanvasNode = React.memo(CanvasNodeBase);

interface GroupNodeProps {
  group: GroupElement;
  ctx: EditorRenderContext;
  state: ReturnType<typeof useElementRenderState>;
}

/**
 * Группа/компонент и рекурсивно её состав: composition (примитивы) + children
 * (компоненты). Живёт в одном файле с CanvasNode — рекурсия идёт через него.
 */
function GroupNode({ group, ctx, state }: GroupNodeProps) {
  const { updateElementVisual, onElementClick, resolveClickTarget, enterGroup, themeColors } = ctx;
  const { isSelected, isActiveGroup } = state;
  const rendered = getRenderedElement(group);

  return (
    <Group
      id={group.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragStart={(e) => {
        if (e.target === e.currentTarget && !isSelected) {
          e.target.stopDrag();
        }
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        // Позиция уже привязана общим обработчиком Stage (сетка + направляющие).
        updateElementVisual(group.key, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        const clickedId = (e.target as Konva.Node).attrs.id
          || (e.target as Konva.Node).parent?.attrs.id
          || (e.target as Konva.Node).parent?.parent?.attrs.id;
        const resolved = clickedId ? resolveClickTarget(clickedId) : group.key;
        if (resolved === group.key) {
          enterGroup(group.key);
        }
      }}
    >
      {/* Background rect: hit area + selection/active border */}
      <Rect
        x={0}
        y={0}
        width={rendered.w}
        height={rendered.h}
        fill="transparent"
        stroke={isActiveGroup ? themeColors.activeGroup : isSelected ? themeColors.selection : "transparent"}
        strokeWidth={isActiveGroup || isSelected ? 2 : 0}
        dash={isActiveGroup ? [6, 3] : [4, 3]}
        listening={true}
        onClick={(e) => {
          e.cancelBubble = true;
          onElementClick(group.key, e.evt.shiftKey || e.evt.ctrlKey);
        }}
        onMouseEnter={e => {
          if (isSelected) {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "move";
          }
        }}
        onMouseLeave={e => {
          const container = e.target.getStage()?.container();
          resetCanvasCursor(container);
        }}
      />
      {[...(group.composition ?? []), ...group.children].map(childKey => (
        <CanvasNode key={childKey} elementKey={childKey} ctx={ctx} />
      ))}
    </Group>
  );
}
