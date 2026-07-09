"use client";

import React from "react";
import { Group, Rect } from "react-konva";
import Konva from "konva";
import { GroupElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { EditorRenderContext } from "../types";
import { ShapeElement } from "./ShapeElement";

interface GroupNodeProps {
  group: GroupElement;
  ctx: EditorRenderContext;
}

/** Рендерит группу/компонент и рекурсивно её состав: composition (примитивы) + children (компоненты). */
export function GroupNode({ group, ctx }: GroupNodeProps) {
  const { snap, updateElementVisual, onElementClick, resolveClickTarget, enterGroup, elementsMap } = ctx;
  const isSelected = ctx.selectedIds.includes(group.key);
  const isActive = ctx.activeGroupKey === group.key;
  const rendered = getRenderedElement(group);

  return (
    <Group
      key={group.key}
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
        updateElementVisual(group.key, {
          x: snap(e.target.x()),
          y: snap(e.target.y()),
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
        stroke={isActive ? "#f59e0b" : isSelected ? "#3b82f6" : "transparent"}
        strokeWidth={isActive || isSelected ? 2 : 0}
        dash={isActive ? [6, 3] : [4, 3]}
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
          if (container) container.style.cursor = "default";
        }}
      />
      {[...(group.composition ?? []), ...group.children].map(childId => {
        const child = elementsMap[childId];
        if (!child) return null;
        return child.type === "group"
          ? <GroupNode key={child.key} group={child as GroupElement} ctx={ctx} />
          : <ShapeElement key={child.key} el={child} ctx={ctx} />;
      })}
    </Group>
  );
}
