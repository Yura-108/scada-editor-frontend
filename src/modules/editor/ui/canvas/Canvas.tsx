"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import Konva from "konva";
import { Stage, Layer } from "react-konva";

import { useShallow } from "zustand/react/shallow";

import { useEditorStore } from "../../model/editorStore";
import {useRuntimeOverlayStore, snap, resolveSheet, getChildElements, getElementIndex, selectVisibleRootKeys, monitorViewFromCamera, resolveMonitorView, sortByZIndex} from "@/core/scene";
import {NON_TRANSFORMABLE, CanvasNode, useThemeColors} from "@/core/canvas";
// Импорт ради побочного эффекта: глобальные настройки Konva (порог начала drag'а)
// должны примениться до создания Stage.
import "./lib/konvaConfig";

import { TextEditorOverlay } from "./TextEditorOverlay";
import { ZoomControls } from "./ZoomControls";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { useCanvasRect } from "./hooks/useCanvasRect";
import { useEditorHotkeys } from "./hooks/useEditorHotkeys";
import { useStageInteractions } from "./hooks/useStageInteractions";
import { useMultiDragAndGuides } from "./hooks/useMultiDragAndGuides";
import { useZoomControls } from "./hooks/useZoomControls";
import { useHoverHighlight } from "./hooks/useHoverHighlight";
import { usePendingPlacement } from "./hooks/usePendingPlacement";
import { MonitorInteractionLayer } from "./layers/MonitorInteractionLayer";
import RuntimeNoticeLayer from "@/components/monitor/RuntimeNoticeLayer";
import type { EditorRenderContext } from "@/core/canvas";
import type { CanvasMenuState } from "./types";
import { CanvasModals } from "./CanvasModals";
import { BackgroundLayer } from "./layers/BackgroundLayer";
import { OverlayLayer } from "./layers/OverlayLayer";
import { useElementClick } from "./hooks/useElementClick";
import { useMonitorClicks } from "./hooks/useMonitorClicks";
import { useEditorContextMenu } from "./hooks/useEditorContextMenu";

interface CanvasProps {
  /**
   * Режим монитора: сцена только отображается. Layer выключается из hit-графа
   * Konva (listening=false) — клики/drag/dblclick по фигурам не работают,
   * маркиз/хоткеи/контекст-меню отключены; пан/зум камеры остаются.
   */
  readOnly?: boolean;
  /**
   * Монитор в режиме «Архив»: действия выключены — слой кликов по скриптам не монтируется,
   * а меню элемента сводится к «Открыть тренд». Записей в ПЛК из архива быть не может.
   */
  archive?: boolean;
}

export function Canvas({ readOnly = false, archive = false }: CanvasProps) {
  // Точечный срез вместо подписки на весь стор: без него холст перерисовывался на
  // ЛЮБОЕ изменение (sceneList, projectList, clipboard, currentProject …), а не
  // только на то, что он рисует. Ср. тот же приём в WorkSpace.
  const {
    elements, selectedIds, selectMultiple, setCanvasRect,
    deleteSelectedElement, copySelectedElement, pasteSelectedElement,
    camera, scene, setCameraPan, setCameraZoom, updateElementVisual,
    activeGroupKey, enterGroup, exitGroup, clearSelection,
    canvasRect,
    moveSelectedBy, duplicateSelected, selectAllInScope, setCamera,
    pendingPlacement, setEditingTextKey, editingTextKey,
    groupSelected, ungroupSelected,
    setMonitorView,
  } = useEditorStore(useShallow(s => ({
    elements: s.elements, selectedIds: s.selectedIds, selectMultiple: s.selectMultiple,
    setCanvasRect: s.setCanvasRect,
    deleteSelectedElement: s.deleteSelectedElement, copySelectedElement: s.copySelectedElement,
    pasteSelectedElement: s.pasteSelectedElement,
    camera: s.camera, scene: s.scene, setCameraPan: s.setCameraPan, setCameraZoom: s.setCameraZoom,
    updateElementVisual: s.updateElementVisual,
    activeGroupKey: s.activeGroupKey, enterGroup: s.enterGroup, exitGroup: s.exitGroup,
    clearSelection: s.clearSelection,
    canvasRect: s.canvasRect,
    moveSelectedBy: s.moveSelectedBy, duplicateSelected: s.duplicateSelected,
    selectAllInScope: s.selectAllInScope, setCamera: s.setCamera,
    pendingPlacement: s.pendingPlacement,
    setEditingTextKey: s.setEditingTextKey, editingTextKey: s.editingTextKey,
    groupSelected: s.groupSelected, ungroupSelected: s.ungroupSelected,
    setMonitorView: s.setMonitorView,
  })));
  // «Нет данных» — рантайм-слой монитора (core/scene), не стор редактора.
  const noDataElementKeys = useRuntimeOverlayStore(s => s.noDataKeys);

  const { resolvedTheme, themeColors } = useThemeColors();

  const [contextMenu, setContextMenu] = useState<CanvasMenuState | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  useCanvasRect(containerRef, setCanvasRect);
  useEditorHotkeys({
    enabled: !readOnly,
    activeGroupKey, exitGroup, clearSelection, deleteSelectedElement, copySelectedElement, pasteSelectedElement,
    duplicateSelected, selectAllInScope, moveSelectedBy, groupSelected, ungroupSelected,
  });

  // Общий индекс массива (кэшируется по ссылке на него): key→элемент и
  // parentKey→ключи детей. Раньше Canvas строил свою карту, а геометрия
  // параллельно бегала по массиву линейным поиском.
  const elementIndex = useMemo(() => getElementIndex(elements), [elements]);
  const elementsMap = elementIndex.byKey;
  // Порядок отрисовки корней — по zIndex; сортировка стабильная, поэтому при
  // равных слоях (в т.ч. у схем, где слои никто не трогал) остаётся порядок
  // массива. Сортируем ДО отсечения по видимой области: selectVisibleRootKeys
  // только фильтрует и порядок сохраняет.
  const rootElements = useMemo(
    () => sortByZIndex(getChildElements(String(scene?.id ?? ""), elementIndex)),
    [elementIndex, scene],
  );

  /** Лист сцены. Считается из elements (кэш по ссылке на массив), в сторе не хранится. */
  const sheet = useMemo(() => resolveSheet(elements), [elements]);
  // Вид, зафиксированный для монитора (замок в панели зума). В редакторе — рамка и
  // нажатая кнопка, в мониторе — камера и запрет зума/пана (см. lib/editor/monitorView.ts).
  const monitorView = useMemo(() => resolveMonitorView(elements), [elements]);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const { resolveClickTarget, handleElementClick, onTableCellClick } = useElementClick();

  const { handleStagePlacementClick } = usePendingPlacement({ stageRef, pendingPlacement });

  const { selectionRect, handleWheel, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp } = useStageInteractions({
    stageRef, camera, setCameraPan, setCameraZoom,
    elements, elementsMap, selectedIds, selectMultiple,
    activeGroupKey, exitGroup, closeMenu, resolveClickTarget,
    readOnly,
  });

  // ---- Hover-подсветка (как в Figma: показываем рамку того, что выберется по клику) ----
  const { hoverHighlight, handleStageMouseOver, clearHover } = useHoverHighlight({
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

  // ---- Culling: на больших схемах монтируем только то, что рядом с экраном ----
  const visibleRootKeys = useMemo(
    () => selectVisibleRootKeys({
      rootElements,
      elementIndex,
      camera,
      canvasRect,
      selectedIds,
      activeGroupKey,
    }),
    [rootElements, elementIndex, camera, canvasRect, selectedIds, activeGroupKey],
  );

  const { zoomStep, zoomFit, zoomFitSheet } = useZoomControls({ canvasRect, setCamera });

  const { handleMonitorContextMenu, handleMonitorClick, handleMonitorDblClick } = useMonitorClicks({
    stageRef, readOnly, archive, closeMenu, setContextMenu, enterGroup,
  });

  const {
    handleEditorContextMenu, moveToGroupState, closeMoveToGroup, addComponentState, closeAddComponent,
  } = useEditorContextMenu({ elements, elementsMap, resolveClickTarget, closeMenu, setContextMenu });

  const handleStageContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (readOnly) { handleMonitorContextMenu(e); return; }
    handleEditorContextMenu(e);
  };

  // ctx СТАБИЛЕН по ссылке: только палитра и колбэки, ничего изменчивого.
  // Всё, что меняется при работе (выделение, состав схемы, активное состояние,
  // редактируемый текст, сфокусированная ячейка), каждый узел читает про себя
  // сам — см. useElementRenderState. Пока это ехало общим контекстом, React.memo
  // на узлах не срабатывал ни разу: любая правка перерисовывала всю сцену.
  const ctx: EditorRenderContext = useMemo(() => ({
    themeColors, snap,
    updateElementVisual, onElementClick: handleElementClick, enterGroup, resolveClickTarget, closeMenu,
    onStartTextEdit: setEditingTextKey,
    onTableCellClick,
  }), [
    themeColors, updateElementVisual, handleElementClick, enterGroup,
    resolveClickTarget, closeMenu, setEditingTextKey, onTableCellClick,
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
          // Stage — строго под размер видимой области (canvasRect), а НЕ под размер
          // листа: Konva аллоцирует канвасы width×height×DPR на слой (+хит-канвас),
          // и Stage размером с лист A0 (21520×15240) съел бы сотни МБ и превысил
          // лимит canvas в Safari. Лист остаётся виртуальным — его даёт трансформ
          // камеры (x/y/scale) и прямоугольник в слое фона.
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
          onClick={readOnly ? handleMonitorClick : handleStagePlacementClick}
          onTap={readOnly ? handleMonitorClick : undefined}
          onDblClick={readOnly ? handleMonitorDblClick : undefined}
          onDblTap={readOnly ? handleMonitorDblClick : undefined}
          onContextMenu={handleStageContextMenu}
          onDragStart={handleStageDragStart}
          onDragMove={handleStageDragMove}
          onDragEnd={handleStageDragEnd}
          onMouseOver={readOnly ? undefined : handleStageMouseOver}
          onMouseLeave={clearHover}
        >
          <BackgroundLayer sheet={sheet} zoom={camera.zoom} themeColors={themeColors} resolvedTheme={resolvedTheme} />

          {/* Слой содержимого: сами фигуры.
              readOnly (монитор): слой вне hit-графа Konva — фигуры не кликаются
              и не драгаются, при этом пан/зум Stage работают как обычно. */}
          <Layer listening={!readOnly}>
            {visibleRootKeys.map(key => (
              <CanvasNode key={key} elementKey={key} ctx={ctx} />
            ))}
          </Layer>

          <OverlayLayer
            readOnly={readOnly}
            themeColors={themeColors}
            zoom={camera.zoom}
            sheet={sheet}
            monitorView={monitorView}
            noDataElementKeys={noDataElementKeys}
            elements={elements}
            elementsMap={elementsMap}
            hoverHighlight={hoverHighlight}
            selectionRect={selectionRect}
            guides={guides}
            transformTarget={transformTarget}
            stageRef={stageRef}
            updateElementVisual={updateElementVisual}
          />

          {/* Монитор: отдельный слой кликов по элементам с обработчиками событий
              (основной слой в readOnly не слушает — интерактив только здесь). */}
          {readOnly && !archive && <MonitorInteractionLayer elements={elements} elementsMap={elementsMap} />}
        </Stage>
      </div>

      {/* Монитор: отказ в действии — у точки нажатия. */}
      {readOnly && !archive && <RuntimeNoticeLayer />}

      {editingTextKey && (
        <TextEditorOverlay
          elementKey={editingTextKey}
          elementsMap={elementsMap}
          onClose={() => setEditingTextKey(null)}
        />
      )}

      <ZoomControls
        zoom={camera.zoom}
        onZoomStep={zoomStep}
        onFit={zoomFit}
        onFitSheet={zoomFitSheet}
        onReset={() => setCamera(0, 0, 1)}
        readOnly={readOnly}
        viewLocked={!!monitorView}
        // Замок фиксирует то, что видно СЕЙЧАС; повторное нажатие снимает фиксацию.
        onToggleViewLock={() => {
          if (monitorView) { setMonitorView(null); return; }
          if (canvasRect) setMonitorView(monitorViewFromCamera(camera, canvasRect));
        }}
      />

      <CanvasContextMenu menu={contextMenu} onClose={closeMenu} />

      <CanvasModals
        moveToGroupState={moveToGroupState}
        closeMoveToGroup={closeMoveToGroup}
        addComponentState={addComponentState}
        closeAddComponent={closeAddComponent}
      />
    </div>
  );
}
