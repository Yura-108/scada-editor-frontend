"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import Konva from "konva";
import { Stage, Layer, Rect } from "react-konva";

import { useEditorStore } from "@/store/useEditorStore";
import { snap } from "@/lib/utils";
import { DiagramElement, GroupElement } from "@/types/editorElement.type";
import { resolveClickTarget as resolveClickTargetFn } from "@/lib/editor/resolveClickTarget";
import { createGridPattern } from "@/lib/editor/gridPattern";

import { MoveToGroupModal } from "@/components/ui/MoveToGroupModal";
import { AddComponentModal } from "@/components/ui/AddComponentModal";

import { ShapeElement } from "./canvas/shapes/ShapeElement";
import { GroupNode } from "./canvas/shapes/GroupNode";
import { CanvasContextMenu } from "./canvas/CanvasContextMenu";
import { buildItemMenu } from "./canvas/buildItemMenu";
import { useThemeColors } from "./canvas/useThemeColors";
import { useCanvasRect } from "./canvas/hooks/useCanvasRect";
import { useEditorHotkeys } from "./canvas/hooks/useEditorHotkeys";
import { useStageInteractions } from "./canvas/hooks/useStageInteractions";
import type { CanvasMenuItem, EditorRenderContext } from "./canvas/types";

const CANVAS_WIDTH = 5000;
const CANVAS_HEIGHT = 5000;

export default function Canvas() {
  const {
    elements, selectedIds, selectMultiple, setCanvasRect,
    deleteSelectedElement, copySelectedElement, pasteSelectedElement,
    camera, scene, setCameraPan, setCameraZoom, updateElementVisual,
    activeGroupKey, enterGroup, exitGroup, clearSelection,
  } = useEditorStore();

  const { resolvedTheme, themeColors } = useThemeColors();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: CanvasMenuItem[] } | null>(null);
  const [moveToGroupState, setMoveToGroupState] = useState<{ isOpen: boolean; elementKey: string | null }>({ isOpen: false, elementKey: null });
  const [addComponentState, setAddComponentState] = useState<{ isOpen: boolean; targetKey: string | null }>({ isOpen: false, targetKey: null });

  const { setNodeRef } = useDroppable({ id: "canvas" });
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  useCanvasRect(containerRef, setCanvasRect);
  useEditorHotkeys({ activeGroupKey, exitGroup, clearSelection, deleteSelectedElement, copySelectedElement, pasteSelectedElement });

  const rootElements = useMemo(() => elements.filter(el => el.parentKey === String(scene?.id)), [elements, scene]);
  const elementsMap = useMemo(() => {
    const map: Record<string, DiagramElement> = {};
    elements.forEach(el => { map[el.key] = el; });
    return map;
  }, [elements]);

  const gridPattern = useMemo(() => createGridPattern(themeColors.gridLine), [themeColors.gridLine]);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const resolveClickTarget = useCallback(
    (key: string) => resolveClickTargetFn(key, elementsMap, activeGroupKey, String(scene?.id)),
    [elementsMap, activeGroupKey, scene],
  );

  const handleElementClick = useCallback((clickedKey: string, multi: boolean) => {
    const target = resolveClickTarget(clickedKey);
    if (target === null) { exitGroup(); return; }
    selectMultiple(multi ? [...selectedIds.filter(id => id !== target), target] : [target]);
  }, [resolveClickTarget, exitGroup, selectMultiple, selectedIds]);

  const { selectionRect, handleWheel, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp } = useStageInteractions({
    stageRef, camera, setCameraPan, setCameraZoom,
    elements, elementsMap, selectedIds, selectMultiple,
    activeGroupKey, exitGroup, closeMenu,
  });

  const handleStageContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    const tg = e.target;

    if (tg === e.target.getStage() || tg.name() === "grid-bg") {
      setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [{ label: "Вставить", onClick: () => { pasteSelectedElement(); closeMenu(); } }],
      });
      return;
    }

    const elId = tg.attrs.id || tg.parent?.attrs.id || tg.parent?.parent?.attrs.id;
    if (!elId) return;

    selectMultiple([elId]);
    const el = elementsMap[elId];
    if (!el) return;

    setContextMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      items: buildItemMenu(el, {
        elements,
        closeMenu,
        copySelectedElement,
        deleteSelectedElement,
        openMoveToGroup: (key) => setMoveToGroupState({ isOpen: true, elementKey: key }),
        openAddComponent: (key) => setAddComponentState({ isOpen: true, targetKey: key }),
      }),
    });
  };

  const ctx: EditorRenderContext = {
    selectedIds, activeGroupKey, elementsMap, themeColors, snap,
    updateElementVisual, onElementClick: handleElementClick, enterGroup, resolveClickTarget, closeMenu,
  };

  return (
    <div
      ref={containerRef}
      id="canvas-viewport"
      className="relative w-full h-full overflow-hidden bg-white dark:bg-neutral-950 context-menu-container"
    >
      <div ref={setNodeRef} style={{ width: "100%", height: "100%" }} onContextMenu={(e) => e.preventDefault()}>
        <Stage
          ref={stageRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          scaleX={camera.zoom}
          scaleY={camera.zoom}
          x={camera.x}
          y={camera.y}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onContextMenu={handleStageContextMenu}
        >
          <Layer>
            <Rect
              key={`canvas-bg-${resolvedTheme}`}
              name="canvas-bg"
              x={-CANVAS_WIDTH / 2}
              y={-CANVAS_HEIGHT / 2}
              width={CANVAS_WIDTH * 2}
              height={CANVAS_HEIGHT * 2}
              fill={themeColors.canvasBg}
              listening={false}
            />
            <Rect
              key={`grid-${resolvedTheme}`}
              name="grid-bg"
              x={-CANVAS_WIDTH / 2}
              y={-CANVAS_HEIGHT / 2}
              width={CANVAS_WIDTH * 2}
              height={CANVAS_HEIGHT * 2}
              fillPriority="pattern"
              fillPatternImage={gridPattern as unknown as HTMLImageElement}
            />

            {rootElements.map(el => (
              el.type === "group"
                ? <GroupNode key={el.key} group={el as GroupElement} ctx={ctx} />
                : <ShapeElement key={el.key} el={el} ctx={ctx} />
            ))}

            {selectionRect && (
              <Rect
                x={Math.min(selectionRect.x, selectionRect.x + selectionRect.width)}
                y={Math.min(selectionRect.y, selectionRect.y + selectionRect.height)}
                width={Math.abs(selectionRect.width)}
                height={Math.abs(selectionRect.height)}
                fill="rgba(0, 150, 255, 0.2)"
                stroke="#0096ff"
                strokeWidth={1}
              />
            )}
          </Layer>
        </Stage>
      </div>

      <CanvasContextMenu menu={contextMenu} />

      <MoveToGroupModal
        isOpen={moveToGroupState.isOpen}
        elementKey={moveToGroupState.elementKey}
        onClose={() => setMoveToGroupState({ isOpen: false, elementKey: null })}
      />

      <AddComponentModal
        isOpen={addComponentState.isOpen}
        targetKey={addComponentState.targetKey}
        onClose={() => setAddComponentState({ isOpen: false, targetKey: null })}
      />
    </div>
  );
}
