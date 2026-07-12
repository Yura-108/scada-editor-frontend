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
import { getElementBoundsRendered } from "@/lib/getElementBounds";
import { getAbsoluteRenderedPos } from "@/lib/editor/getAbsoluteRenderedPos";
import { getRenderedElement } from "@/lib/getRenderedElement";

import { MoveToGroupModal } from "@/components/ui/MoveToGroupModal";
import { AddComponentModal } from "@/components/ui/AddComponentModal";

import { ShapeElement } from "./canvas/shapes/ShapeElement";
import { GroupNode } from "./canvas/shapes/GroupNode";
import { TextEditorOverlay } from "./canvas/shapes/TextEditorOverlay";
import { ZoomControls } from "./canvas/ZoomControls";
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
    canvasRect, currentComponentStateByElementKey,
    moveSelectedBy, duplicateSelected, selectAllInScope, setCamera,
  } = useEditorStore();

  const { resolvedTheme, themeColors } = useThemeColors();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: CanvasMenuItem[] } | null>(null);
  const [moveToGroupState, setMoveToGroupState] = useState<{ isOpen: boolean; elementKey: string | null }>({ isOpen: false, elementKey: null });
  const [addComponentState, setAddComponentState] = useState<{ isOpen: boolean; targetKey: string | null }>({ isOpen: false, targetKey: null });
  const [editingTextKey, setEditingTextKey] = useState<string | null>(null);
  // Hover-подсветка: ключ элемента, который выберется по клику (для члена группы — сама группа).
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const { setNodeRef } = useDroppable({ id: "canvas" });
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  useCanvasRect(containerRef, setCanvasRect);
  useEditorHotkeys({
    activeGroupKey, exitGroup, clearSelection, deleteSelectedElement, copySelectedElement, pasteSelectedElement,
    duplicateSelected, selectAllInScope, moveSelectedBy,
  });

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

  // ---- Мульти-drag: тянем один выделенный элемент — остальные едут следом. ----
  // Drag-события Konva всплывают до Stage; сессия стартует, только если цель
  // резолвится в выделенный элемент (ручки ресайза исключены по name).
  const multiDragRef = useRef<{
    draggedKey: string;
    draggedOrig: { x: number; y: number };
    others: { node: Konva.Node; orig: { x: number; y: number } }[];
  } | null>(null);

  const resolveDragKey = useCallback((target: Konva.Node): string | null => {
    if (target.name() === "resize-handle") return null;
    let node: Konva.Node | null = target;
    // Драггаться может и внутренний узел (Arrow у линии, Circle у круга) — id лежит на группе выше.
    for (let i = 0; i < 3 && node; i++) {
      const id = node.id();
      if (id && elementsMap[id]) return id;
      node = node.getParent();
    }
    return null;
  }, [elementsMap]);

  const handleStageDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // Прячем hover-подсветку на время перетаскивания — иначе рамка зависает на старом месте.
    setHoveredKey(null);
    if (selectedIds.length < 2) return;
    const key = resolveDragKey(e.target);
    if (!key || !selectedIds.includes(key)) return;
    const stage = stageRef.current;
    if (!stage) return;

    // Двигаем только верхнеуровневые выделенные — элемент с выделенным предком едет с ним.
    const selectedSet = new Set(selectedIds);
    const hasSelectedAncestor = (k: string): boolean => {
      let pk = elementsMap[k]?.parentKey;
      while (pk) {
        if (selectedSet.has(pk)) return true;
        pk = elementsMap[pk]?.parentKey ?? null;
      }
      return false;
    };

    const others = selectedIds
      .filter(k => k !== key && !hasSelectedAncestor(k))
      .map(k => stage.findOne(`#${k}`))
      .filter((n): n is Konva.Node => Boolean(n))
      .map(n => ({ node: n, orig: n.position() }));

    if (!others.length) return;
    multiDragRef.current = { draggedKey: key, draggedOrig: e.target.position(), others };
  }, [selectedIds, elementsMap, resolveDragKey]);

  const handleStageDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const session = multiDragRef.current;
    if (!session) return;
    const dx = e.target.x() - session.draggedOrig.x;
    const dy = e.target.y() - session.draggedOrig.y;
    for (const { node, orig } of session.others) {
      node.position({ x: orig.x + dx, y: orig.y + dy });
    }
  }, []);

  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const session = multiDragRef.current;
    if (!session) return;
    multiDragRef.current = null;

    // Дельта в терминах закоммиченного (снапнутого) значения перетащенного элемента.
    const dx = snap(e.target.x()) - session.draggedOrig.x;
    const dy = snap(e.target.y()) - session.draggedOrig.y;

    // Возвращаем императивно сдвинутые узлы на исходные позиции ДО коммита:
    // у линий/кругов группа не имеет controlled x/y, и React сам не сбросил бы сдвиг.
    for (const { node, orig } of session.others) node.position(orig);

    moveSelectedBy(dx, dy, session.draggedKey);
  }, [moveSelectedBy]);

  // ---- Hover-подсветка (как в Figma: показываем рамку того, что выберется по клику) ----
  // Для члена группы это рамка самой группы — сразу видно, что элементы объединены.
  const handleStageMouseOver = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    let node: Konva.Node | null = e.target;
    let key: string | null = null;
    // id элемента может лежать на группе выше цели (Arrow у линии, Circle у круга и т.п.)
    for (let i = 0; i < 4 && node; i++) {
      const id = node.id();
      if (id && elementsMap[id]) { key = id; break; }
      node = node.getParent();
    }
    setHoveredKey(key ? resolveClickTarget(key) : null);
  }, [elementsMap, resolveClickTarget]);

  const hoverBounds = useMemo(() => {
    if (!hoveredKey || selectedIds.includes(hoveredKey)) return null;
    const el = elementsMap[hoveredKey];
    if (!el) return null;
    // Для группы показываем её рамку (то, что выберется по клику); для листа — фактические границы.
    if (el.type === "group") {
      const abs = getAbsoluteRenderedPos(el, elementsMap);
      const rendered = getRenderedElement(el);
      return { x: abs.x, y: abs.y, w: rendered.w, h: rendered.h };
    }
    const b = getElementBoundsRendered(el, elements);
    return { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
  }, [hoveredKey, elementsMap, elements, selectedIds]);

  // ---- Zoom-панель ----
  const clampZoom = (z: number) => Math.min(Math.max(z, 0.2), 3);

  const zoomBy = useCallback((factor: number) => {
    // Зумируем вокруг центра видимой области, чтобы картинка не «уезжала».
    const cx = (canvasRect?.width ?? 800) / 2;
    const cy = (canvasRect?.height ?? 600) / 2;
    const cam = useEditorStore.getState().camera;
    const nz = clampZoom(cam.zoom * factor);
    setCamera(cx - ((cx - cam.x) * nz) / cam.zoom, cy - ((cy - cam.y) * nz) / cam.zoom, nz);
  }, [canvasRect, setCamera]);

  const zoomFit = useCallback(() => {
    if (!canvasRect) return;
    const { elements: els, scene: sc } = useEditorStore.getState();
    const roots = els.filter(el => el.parentKey === String(sc?.id));
    if (!roots.length) { setCamera(0, 0, 1); return; }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of roots) {
      const b = getElementBoundsRendered(el, els);
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    }
    if (!isFinite(minX)) return;

    const pad = 60;
    const nz = clampZoom(Math.min(
      canvasRect.width / (maxX - minX + pad * 2),
      canvasRect.height / (maxY - minY + pad * 2),
    ));
    setCamera(
      (canvasRect.width - (maxX - minX) * nz) / 2 - minX * nz,
      (canvasRect.height - (maxY - minY) * nz) / 2 - minY * nz,
      nz,
    );
  }, [canvasRect, setCamera]);

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

  // Стабильный ctx (useMemo) — ключ к мемоизации фигур: пан/зум/маркиз/меню не меняют
  // его identity, и React.memo пропускает ре-рендер всей сцены. currentComponentStateByElementKey
  // в deps обязателен: переключение состояния меняет ctx и «пробивает» memo (getRenderedElement
  // читает состояние нереактивно через getState()).
  const ctx: EditorRenderContext = useMemo(() => ({
    selectedIds, activeGroupKey, elementsMap, themeColors, snap,
    updateElementVisual, onElementClick: handleElementClick, enterGroup, resolveClickTarget, closeMenu,
    editingTextKey, onStartTextEdit: setEditingTextKey,
    currentComponentStateByElementKey,
  }), [
    selectedIds, activeGroupKey, elementsMap, themeColors,
    updateElementVisual, handleElementClick, enterGroup, resolveClickTarget, closeMenu,
    editingTextKey, currentComponentStateByElementKey,
  ]);

  return (
    <div
      ref={containerRef}
      id="canvas-viewport"
      className="relative w-full h-full overflow-hidden bg-white dark:bg-neutral-950 context-menu-container"
    >
      <div ref={setNodeRef} style={{ width: "100%", height: "100%" }} onContextMenu={(e) => e.preventDefault()}>
        <Stage
          ref={stageRef}
          // Stage — строго под размер видимой области (canvasRect), НЕ 5000×5000:
          // Konva аллоцирует канвасы width×height×DPR на слой (+hit-канвас) — фикс. 5000×5000
          // съедал сотни МБ и превышал лимит canvas в Safari. «Мир» 5000×5000 остаётся
          // виртуальным — его даёт трансформ камеры (x/y/scale).
          width={canvasRect?.width ?? 800}
          height={canvasRect?.height ?? 600}
          scaleX={camera.zoom}
          scaleY={camera.zoom}
          x={camera.x}
          y={camera.y}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onContextMenu={handleStageContextMenu}
          onDragStart={handleStageDragStart}
          onDragMove={handleStageDragMove}
          onDragEnd={handleStageDragEnd}
          onMouseOver={handleStageMouseOver}
          onMouseLeave={() => setHoveredKey(null)}
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

            {/* Hover-подсветка: один оверлей-Rect вместо пропса в фигуры — иначе каждое
                движение мыши ре-рендерило бы всю мемоизированную сцену. */}
            {hoverBounds && !selectionRect && (
              <Rect
                x={hoverBounds.x - 2}
                y={hoverBounds.y - 2}
                width={hoverBounds.w + 4}
                height={hoverBounds.h + 4}
                stroke="#3b82f6"
                strokeWidth={1.5}
                dash={[5, 3]}
                opacity={0.7}
                cornerRadius={2}
                listening={false}
              />
            )}

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

      {editingTextKey && (
        <TextEditorOverlay
          elementKey={editingTextKey}
          elementsMap={elementsMap}
          onClose={() => setEditingTextKey(null)}
        />
      )}

      <ZoomControls
        zoom={camera.zoom}
        onZoomBy={zoomBy}
        onFit={zoomFit}
        onReset={() => setCamera(0, 0, 1)}
      />

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
