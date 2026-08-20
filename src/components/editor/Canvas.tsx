"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import Konva from "konva";
import { Stage, Layer, Rect, Line, Circle } from "react-konva";

import { useShallow } from "zustand/react/shallow";

import { useEditorStore } from "@/store/useEditorStore";
import { snap } from "@/lib/utils";
import { resolveClickTarget as resolveClickTargetFn } from "@/lib/editor/resolveClickTarget";
import { createGridPattern } from "@/lib/editor/gridPattern";
import { getChildElements, getElementIndex } from "@/lib/editor/elementIndex";
import { selectVisibleRootKeys } from "@/lib/editor/viewportCulling";
import { NON_TRANSFORMABLE } from "./canvas/useElementRenderState";
// Импорт ради побочного эффекта: глобальные настройки Konva (порог начала drag'а)
// должны примениться до создания Stage.
import "@/lib/editor/konvaConfig";

import { MoveToGroupModal } from "@/components/ui/MoveToGroupModal";
import { AddComponentModal } from "@/components/ui/AddComponentModal";

import { CanvasNode } from "./canvas/shapes/CanvasNode";
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

interface CanvasProps {
  /**
   * Режим монитора: сцена только отображается. Layer выключается из hit-графа
   * Konva (listening=false) — клики/drag/dblclick по фигурам не работают,
   * маркиз/хоткеи/контекст-меню отключены; пан/зум камеры остаются.
   */
  readOnly?: boolean;
}

export default function Canvas({ readOnly = false }: CanvasProps) {
  // Точечный срез вместо подписки на весь стор: без него холст перерисовывался на
  // ЛЮБОЕ изменение (sceneList, projectList, clipboard, currentProject …), а не
  // только на то, что он рисует. Ср. тот же приём в WorkSpace.
  const {
    elements, selectedIds, selectMultiple, setCanvasRect,
    deleteSelectedElement, copySelectedElement, pasteSelectedElement,
    camera, scene, setCameraPan, setCameraZoom, updateElementVisual,
    activeGroupKey, enterGroup, exitGroup, clearSelection,
    canvasRect, noDataElementKeys,
    moveSelectedBy, duplicateSelected, selectAllInScope, setCamera,
    pendingPlacement, setEditingTextKey, editingTextKey,
    groupSelected, ungroupSelected,
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
    noDataElementKeys: s.noDataElementKeys,
    moveSelectedBy: s.moveSelectedBy, duplicateSelected: s.duplicateSelected,
    selectAllInScope: s.selectAllInScope, setCamera: s.setCamera,
    pendingPlacement: s.pendingPlacement,
    setEditingTextKey: s.setEditingTextKey, editingTextKey: s.editingTextKey,
    groupSelected: s.groupSelected, ungroupSelected: s.ungroupSelected,
  })));

  const { resolvedTheme, themeColors } = useThemeColors();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: CanvasMenuItem[] } | null>(null);
  const [moveToGroupState, setMoveToGroupState] = useState<{ isOpen: boolean; elementKey: string | null }>({ isOpen: false, elementKey: null });
  const [addComponentState, setAddComponentState] = useState<{ isOpen: boolean; targetKey: string | null }>({ isOpen: false, targetKey: null });

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
  const rootElements = useMemo(
    () => getChildElements(String(scene?.id ?? ""), elementIndex),
    [elementIndex, scene],
  );

  const gridPattern = useMemo(() => createGridPattern(themeColors.gridLine), [themeColors.gridLine]);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  // Колбэки холста намеренно БЕЗ зависимостей от изменчивого состояния: они
  // попадают в ctx, а ctx обязан быть стабильным по ссылке (иначе не работает
  // мемоизация узлов). Актуальные elements/selectedIds/activeGroupKey читаем
  // через getState() в момент вызова — это обработчики событий, не рендер.
  const resolveClickTarget = useCallback((key: string) => {
    const s = useEditorStore.getState();
    return resolveClickTargetFn(
      key,
      getElementIndex(s.elements).byKey,
      s.activeGroupKey,
      String(s.scene?.id),
    );
  }, []);

  const handleElementClick = useCallback((clickedKey: string, multi: boolean) => {
    const s = useEditorStore.getState();
    // Вооружён инструмент палитры — клик по фигуре ставит новый элемент (на Stage.onClick),
    // а не выделяет существующий.
    if (s.pendingPlacement) return;
    const target = resolveClickTarget(clickedKey);
    if (target === null) { s.exitGroup(); return; }

    if (!multi) {
      s.selectMultiple([target]);
      return;
    }

    // Ctrl/Shift+клик ПЕРЕКЛЮЧАЕТ элемент. Раньше он всегда добавлялся в конец
    // (filter + append), поэтому снять выделение модификатором было невозможно.
    const current = s.selectedIds;
    s.selectMultiple(
      current.includes(target)
        ? current.filter(id => id !== target)
        : [...current, target],
    );
  }, [resolveClickTarget]);

  // Клик по ячейке таблицы: сначала выделяем таблицу целиком (как обычный клик по элементу),
  // затем фокусируем ячейку — handleElementClick/selectMultiple сбрасывают selectedTableCell,
  // поэтому selectTableCell обязан выполниться ПОСЛЕ него в этом же синхронном обработчике.
  const onTableCellClick = useCallback((elementKey: string, row: number, col: number, multi: boolean) => {
    handleElementClick(elementKey, multi);
    useEditorStore.getState().selectTableCell(elementKey, row, col);
  }, [handleElementClick]);

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
          {/* Слой фона: перерисовывается только при смене темы. В общем слое
              сетка размером 10000×10000 переписывалась заново на каждый кадр
              перетаскивания и на каждое движение рамки выделения.
              listening=false — огромный прямоугольник уходит из hit-графа Konva;
              клик по пустому месту приходит на сам Stage, и это уже учтено. */}
          <Layer listening={false}>
            <Rect
              key={`canvas-bg-${resolvedTheme}`}
              name="canvas-bg"
              x={-CANVAS_WIDTH / 2}
              y={-CANVAS_HEIGHT / 2}
              width={CANVAS_WIDTH * 2}
              height={CANVAS_HEIGHT * 2}
              fill={themeColors.canvasBg}
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
          </Layer>

          {/* Слой содержимого: сами фигуры.
              readOnly (монитор): слой вне hit-графа Konva — фигуры не кликаются
              и не драгаются, при этом пан/зум Stage работают как обычно. */}
          <Layer listening={!readOnly}>
            {visibleRootKeys.map(key => (
              <CanvasNode key={key} elementKey={key} ctx={ctx} />
            ))}
          </Layer>

          {/* Слой оверлеев: подсветка, направляющие, рамка выделения, Transformer.
              Живёт отдельно, чтобы движение мыши при протяжке рамки или
              перетаскивании перерисовывало только его, а не всю сцену. */}
          <Layer listening={!readOnly}>
            {/* «Нет данных» (монитор, docs/contract/TAG_CONTRACT_CHANGES.md B2/B4): пустой набор
                вне монитора — движок рантайма там не запущен. */}
            <NoDataOverlay noDataElementKeys={noDataElementKeys} elements={elements} elementsMap={elementsMap} />

            {/* Hover-подсветка: один оверлей вместо пропса в фигуры — иначе каждое
                движение мыши ре-рендерило бы всю мемоизированную сцену.

                Форма повторяет геометрию фигуры, а не её габарит: у наклонного отрезка
                габаритный прямоугольник накрывает пол-листа вместе с соседями, и понять
                по нему, что именно выберется, невозможно (см. useHoverHighlight).

                strokeScaleEnabled={false} — толщина и штрих в ЭКРАННЫХ пикселях: подсветка
                остаётся одинаково тонкой и на общем виде листа, и при сильном приближении. */}
            {hoverHighlight && !selectionRect && (() => {
              const common = {
                stroke: themeColors.selection,
                strokeWidth: 1.5,
                dash: [5, 3],
                opacity: 0.7,
                strokeScaleEnabled: false,
                listening: false,
              };

              if (hoverHighlight.kind === "line") {
                return (
                  <Line
                    {...common}
                    points={hoverHighlight.points}
                    // Сплошная и толще: подсветка ложится поверх самой линии, и пунктир
                    // на пунктире читался бы хуже, чем «утолщение» под курсором.
                    dash={undefined}
                    strokeWidth={4}
                    opacity={0.45}
                  />
                );
              }

              if (hoverHighlight.kind === "circle") {
                return (
                  <Circle
                    {...common}
                    x={hoverHighlight.x}
                    y={hoverHighlight.y}
                    radius={hoverHighlight.radius + 2}
                  />
                );
              }

              if (hoverHighlight.kind === "polygon") {
                return <Line {...common} points={hoverHighlight.points} closed />;
              }

              return (
                <Rect
                  {...common}
                  x={hoverHighlight.x - 2}
                  y={hoverHighlight.y - 2}
                  width={hoverHighlight.w + 4}
                  height={hoverHighlight.h + 4}
                  cornerRadius={2}
                />
              );
            })()}

            {/* Smart-guides: линии привязки к соседям во время перетаскивания */}
            {guides.v !== null && (
              <Line
                points={[guides.v, -CANVAS_HEIGHT / 2, guides.v, CANVAS_HEIGHT * 1.5]}
                stroke={themeColors.guide}
                strokeWidth={1 / camera.zoom}
                dash={[4, 4]}
                listening={false}
              />
            )}
            {guides.h !== null && (
              <Line
                points={[-CANVAS_WIDTH / 2, guides.h, CANVAS_WIDTH * 1.5, guides.h]}
                stroke={themeColors.guide}
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
                fill={themeColors.selectionFill}
                stroke={themeColors.selection}
                strokeWidth={1}
                listening={false}
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
      />

      <CanvasContextMenu menu={contextMenu} onClose={closeMenu} />

      {/* Монтируем только на время показа: обе модалки читают `elements`, и
          постоянно смонтированные они подписывали холст на лишние обновления. */}
      {moveToGroupState.isOpen && (
        <MoveToGroupModal
          isOpen
          elementKey={moveToGroupState.elementKey}
          onClose={() => setMoveToGroupState({ isOpen: false, elementKey: null })}
        />
      )}

      {addComponentState.isOpen && (
        <AddComponentModal
          isOpen
          targetKey={addComponentState.targetKey}
          onClose={() => setAddComponentState({ isOpen: false, targetKey: null })}
        />
      )}
    </div>
  );
}
