"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import Konva from "konva";
import { Stage, Layer, Rect, Line } from "react-konva";

import { useEditorStore } from "@/store/useEditorStore";
import { snap } from "@/lib/utils";
import { DiagramElement, GroupElement } from "@/types/editorElement.type";
import { resolveClickTarget as resolveClickTargetFn } from "@/lib/editor/resolveClickTarget";
import { createGridPattern } from "@/lib/editor/gridPattern";

import { MoveToGroupModal } from "@/components/ui/MoveToGroupModal";
import { AddComponentModal } from "@/components/ui/AddComponentModal";

import { ShapeElement } from "./canvas/shapes/ShapeElement";
import { GroupNode } from "./canvas/shapes/GroupNode";
import { NoDataOverlay } from "./canvas/shapes/NoDataOverlay";
import { TextEditorOverlay } from "./canvas/shapes/TextEditorOverlay";
import { SelectionTransformer } from "./canvas/shapes/SelectionTransformer";
import { ZoomControls } from "./canvas/ZoomControls";
import { CanvasContextMenu } from "./canvas/CanvasContextMenu";
import { buildItemMenu } from "./canvas/buildItemMenu";
import { useThemeColors } from "./canvas/useThemeColors";
import { useCanvasRect } from "./canvas/hooks/useCanvasRect";
import { useEditorHotkeys } from "./canvas/hooks/useEditorHotkeys";
import { useStageInteractions } from "./canvas/hooks/useStageInteractions";
import { useMultiDragAndGuides } from "./canvas/hooks/useMultiDragAndGuides";
import { useZoomControls } from "./canvas/hooks/useZoomControls";
import { useHoverHighlight } from "./canvas/hooks/useHoverHighlight";
import { usePendingPlacement } from "./canvas/hooks/usePendingPlacement";
import { MonitorInteractionLayer } from "./canvas/MonitorInteractionLayer";
import type { CanvasMenuItem, EditorRenderContext } from "./canvas/types";

const CANVAS_WIDTH = 5000;
const CANVAS_HEIGHT = 5000;

/** Типы со своими специализированными ручками — Transformer к ним не цепляем. */
const NON_TRANSFORMABLE = new Set(["group", "text", "circle", "line", "polygon"]);

interface CanvasProps {
  /**
   * Режим монитора: сцена только отображается. Layer выключается из hit-графа
   * Konva (listening=false) — клики/drag/dblclick по фигурам не работают,
   * маркиз/хоткеи/контекст-меню отключены; пан/зум камеры остаются.
   */
  readOnly?: boolean;
  /**
   * Ширина открытой правой боковой панели (px) — на неё сдвигается панель зума,
   * чтобы не прятаться под панелью. В мониторе панелей нет → 0.
   */
  controlsRightInset?: number;
}

export default function Canvas({ readOnly = false, controlsRightInset = 0 }: CanvasProps) {
  const {
    elements, selectedIds, selectMultiple, setCanvasRect,
    deleteSelectedElement, copySelectedElement, pasteSelectedElement,
    camera, scene, setCameraPan, setCameraZoom, updateElementVisual,
    activeGroupKey, enterGroup, exitGroup, clearSelection,
    canvasRect, currentComponentStateByElementKey, runtimeOverridesByElementKey, noDataElementKeys,
    moveSelectedBy, duplicateSelected, selectAllInScope, setCamera,
    pendingPlacement, selectedTableCell, selectTableCell,
  } = useEditorStore();

  console.log(elements);

  const { resolvedTheme, themeColors } = useThemeColors();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: CanvasMenuItem[] } | null>(null);
  const [moveToGroupState, setMoveToGroupState] = useState<{ isOpen: boolean; elementKey: string | null }>({ isOpen: false, elementKey: null });
  const [addComponentState, setAddComponentState] = useState<{ isOpen: boolean; targetKey: string | null }>({ isOpen: false, targetKey: null });
  const [editingTextKey, setEditingTextKey] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  useCanvasRect(containerRef, setCanvasRect);
  useEditorHotkeys({
    enabled: !readOnly,
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
    // Вооружён инструмент палитры — клик по фигуре ставит новый элемент (на Stage.onClick),
    // а не выделяет существующий.
    if (useEditorStore.getState().pendingPlacement) return;
    const target = resolveClickTarget(clickedKey);
    if (target === null) { exitGroup(); return; }
    selectMultiple(multi ? [...selectedIds.filter(id => id !== target), target] : [target]);
  }, [resolveClickTarget, exitGroup, selectMultiple, selectedIds]);

  // Клик по ячейке таблицы: сначала выделяем таблицу целиком (как обычный клик по элементу),
  // затем фокусируем ячейку — handleElementClick/selectMultiple сбрасывают selectedTableCell,
  // поэтому selectTableCell обязан выполниться ПОСЛЕ него в этом же синхронном обработчике.
  const onTableCellClick = useCallback((elementKey: string, row: number, col: number, multi: boolean) => {
    handleElementClick(elementKey, multi);
    selectTableCell(elementKey, row, col);
  }, [handleElementClick, selectTableCell]);

  const { handleStagePlacementClick } = usePendingPlacement({ stageRef, pendingPlacement });

  const { selectionRect, handleWheel, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp } = useStageInteractions({
    stageRef, camera, setCameraPan, setCameraZoom,
    elements, elementsMap, selectedIds, selectMultiple,
    activeGroupKey, exitGroup, closeMenu,
    readOnly,
  });

  // ---- Hover-подсветка (как в Figma: показываем рамку того, что выберется по клику) ----
  const { hoverBounds, handleStageMouseOver, clearHover } = useHoverHighlight({
    elementsMap, elements, selectedIds, resolveClickTarget,
  });

  const { guides, handleStageDragStart, handleStageDragMove, handleStageDragEnd } = useMultiDragAndGuides({
    stageRef, zoom: camera.zoom, elements, elementsMap, selectedIds, moveSelectedBy, clearHover,
  });

  // ---- Transformer: одиночное выделение бокс-элементов (8 ручек + поворот) ----
  const transformTarget = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const el = elementsMap[selectedIds[0]];
    if (!el || NON_TRANSFORMABLE.has(el.type)) return null;
    return el;
  }, [selectedIds, elementsMap]);

  const { zoomBy, zoomFit } = useZoomControls({ canvasRect, setCamera });

  const handleStageContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (readOnly) return;
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
    runtimeOverridesByElementKey,
    transformerKey: transformTarget?.key ?? null,
    selectedTableCell, onTableCellClick,
  }), [
    selectedIds, activeGroupKey, elementsMap, themeColors,
    updateElementVisual, handleElementClick, enterGroup, resolveClickTarget, closeMenu,
    editingTextKey, currentComponentStateByElementKey, runtimeOverridesByElementKey, transformTarget,
    selectedTableCell, onTableCellClick,
  ]);

  return (
    <div
      ref={containerRef}
      id="canvas-viewport"
      className="relative w-full h-full overflow-hidden bg-white dark:bg-neutral-950 context-menu-container"
    >
      <div style={{ width: "100%", height: "100%" }} onContextMenu={(e) => e.preventDefault()}>
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
          onClick={readOnly ? undefined : handleStagePlacementClick}
          onContextMenu={handleStageContextMenu}
          onDragStart={handleStageDragStart}
          onDragMove={handleStageDragMove}
          onDragEnd={handleStageDragEnd}
          onMouseOver={readOnly ? undefined : handleStageMouseOver}
          onMouseLeave={clearHover}
        >
          {/* readOnly (монитор): слой вне hit-графа Konva — фигуры не кликаются
              и не драгаются, при этом пан/зум Stage работают как обычно. */}
          <Layer listening={!readOnly}>
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

            {/* «Нет данных» (монитор, TAG_CONTRACT_CHANGES.md B2/B4): пустой набор
                вне монитора — движок рантайма там не запущен. */}
            <NoDataOverlay noDataElementKeys={noDataElementKeys} elements={elements} elementsMap={elementsMap} />

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

            {/* Smart-guides: линии привязки к соседям во время перетаскивания */}
            {guides.v !== null && (
              <Line
                points={[guides.v, -CANVAS_HEIGHT / 2, guides.v, CANVAS_HEIGHT * 1.5]}
                stroke="#f43f5e"
                strokeWidth={1 / camera.zoom}
                dash={[4, 4]}
                listening={false}
              />
            )}
            {guides.h !== null && (
              <Line
                points={[-CANVAS_WIDTH / 2, guides.h, CANVAS_WIDTH * 1.5, guides.h]}
                stroke="#f43f5e"
                strokeWidth={1 / camera.zoom}
                dash={[4, 4]}
                listening={false}
              />
            )}

            {/* Transformer: 8 ручек + поворот для одиночного бокс-элемента */}
            {transformTarget && !readOnly && (
              <SelectionTransformer
                element={transformTarget}
                stageRef={stageRef}
                updateElementVisual={updateElementVisual}
                zoom={camera.zoom}
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

          {/* Монитор: отдельный слой кликов по элементам с обработчиками событий
              (основной слой в readOnly не слушает — интерактив только здесь). */}
          {readOnly && <MonitorInteractionLayer elements={elements} elementsMap={elementsMap} />}
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
        rightOffset={controlsRightInset}
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
