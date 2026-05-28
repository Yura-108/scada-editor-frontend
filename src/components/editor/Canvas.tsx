"use client";

import React, {useMemo, useRef, useEffect, useCallback, useState} from "react";
import {useDroppable} from "@dnd-kit/core";
import {useEditorStore} from "@/store/useEditorStore";
import {GRID} from "@/lib/utils";
import NodeElement from "@/components/editor/NodeElement";
import {DiagramElement, GroupElement, LeafElement} from "@/types/editorElement.type";
import {cn} from "@/lib/utils"
import isIntersecting from "@/lib/isIntersecting";
import {LinesLayer} from "@/components/editor/LinesLayer";
import {DynamicContextMenu} from "@/components/ui/ContextMenuRadixUI";
import {editorElementMenuItems} from "@/constants/contextMenuItems";
import {getDescendants} from "@/lib/getDescendants";
import {OpenCreateFaceplateModal} from "@/components/ui/OpenCreateFaceplateModal";
import {Line} from "@/components/ui/SVGComponents/Line";
import {handleAddProperty} from "@/lib/handleAddProperty";
import {getRenderedElement} from "@/lib/getRenderedElement";

export default function Canvas() {
  const {elements,
    selectedIds,
    selectMultiple,
    setCanvasRect,
    deleteSelectedElement,
    copySelectedElement,
    pasteSelectedElement,
    camera,
    scene,
  } = useEditorStore();

  const CANVAS_WIDTH = 5000;
  const CANVAS_HEIGHT = 5000;

  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const {setNodeRef} = useDroppable({id: "canvas"});
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerState = useRef({
    mode: "idle",
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    resizeDir: "",
    resizeElementId: "",
    initialPositions: {} as Record<string, { x: number; y: number; w: number; h: number; rotate: number }>,
    hasDragged: false
  });
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Обновление размеров и позиции canvas
  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        setCanvasRect(containerRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    const resizeObserver = new ResizeObserver(updateRect);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", updateRect);
      resizeObserver.disconnect();
    };
  }, [setCanvasRect]);

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedElement();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelectedElement();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteSelectedElement();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelectedElement, copySelectedElement, pasteSelectedElement]);

  useEffect(() => {
    const el = document.getElementById("canvas-viewport");
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      const {camera, setCameraZoom} = useEditorStore.getState();

      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;

      const oldZoom = camera.zoom;
      const newZoom = Math.min(Math.max(camera.zoom + delta, 0.2), 3);

      if (newZoom === oldZoom) return;

      setCameraZoom(newZoom);
    };

    el.addEventListener("wheel", handler, {passive: false});

    return () => el.removeEventListener("wheel", handler);
  }, []);

  // useEffect(() => {
  //   const viewportWidth = window.innerWidth;
  //   const viewportHeight = window.innerHeight;
  //
  //   const zoom = useEditorStore.getState().camera.zoom;
  //
  //   const centerX = (viewportWidth / 2) - (CANVAS_WIDTH / 2 * zoom);
  //   const centerY = (viewportHeight / 2) - (CANVAS_HEIGHT / 2 * zoom);
  //   useEditorStore.setState((state) => ({
  //     camera: {
  //       ...state.camera,
  //       x: centerX,
  //       y: centerY
  //     }
  //   }));
  // }, []);

  const rootElements = useMemo(
    () => elements.filter(el => el.parentKey === String(scene?.id)),
    [elements]
  );

  const handleSelect = useCallback((id: string, e: React.MouseEvent | React.PointerEvent | MouseEvent) => {
    if (e.shiftKey) {
      const newSelection = selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id];
      selectMultiple(newSelection);
    } else {
      selectMultiple([id]);
    }
  }, [selectedIds, selectMultiple]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const isMiddleClick = e.button === 1 || e.buttons === 4;
    const rect = containerRef.current!.getBoundingClientRect();
    const zoom = useEditorStore.getState().camera.zoom;
    const resizeHandle = (e.target as HTMLElement).closest(".resize-handle");
    const elNode = (e.target as HTMLElement).closest(".scada-selectable");
    const clickElementId = elNode?.getAttribute("data-id");

    if (isMiddleClick) {
      pointerState.current = {
        ...pointerState.current,
        mode: "pan",
        startX: e.clientX,
        startY: e.clientY,
        startPanX: useEditorStore.getState().camera.x,
        startPanY: useEditorStore.getState().camera.y
      };
      (e.currentTarget as HTMLElement).style.cursor = "grabbing";
      return;
    }

    if (resizeHandle && clickElementId) {
      e.stopPropagation();
      e.preventDefault();
      resizeHandle.setPointerCapture(e.pointerId);

      pointerState.current.mode = "resize";
      pointerState.current.hasDragged = false;
      pointerState.current.startX = e.clientX;
      pointerState.current.startY = e.clientY;
      pointerState.current.resizeDir = resizeHandle.getAttribute("data-direction") || "";
      pointerState.current.resizeElementId = clickElementId;

      const el = elementsMap[clickElementId];
      if (el) {
        const rendered = getRenderedElement(el);
        const rotate = (rendered as LeafElement).rotate || 0;
        pointerState.current.initialPositions = {
          [clickElementId]: { x: rendered.x, y: rendered.y, w: rendered.w, h: rendered.h, rotate }
        };
      }
      return;
    }

    if (clickElementId) {
      // Element Drag Mode
      e.stopPropagation();
      e.preventDefault();
      elNode?.setPointerCapture(e.pointerId);

      pointerState.current.mode = "drag";
      pointerState.current.hasDragged = false;
      pointerState.current.startX = e.clientX;
      pointerState.current.startY = e.clientY;

      let actSelect = [...selectedIds];
      if (!selectedIds.includes(clickElementId)) {
        if (e.shiftKey) {
          actSelect = [...selectedIds, clickElementId];
        } else {
          actSelect = [clickElementId];
        }
        selectMultiple(actSelect);
      } else if (e.shiftKey) {
        actSelect = actSelect.filter(i => i !== clickElementId);
        selectMultiple(actSelect);
        return;
      }

      const newInitials: Record<string, {x: number, y: number, w: number, h: number, rotate: number}> = {};
      actSelect.forEach(selId => {
        const el = elementsMap[selId];
        if (el) {
          const rendered = getRenderedElement(el);
          const rotate = (rendered as LeafElement).rotate || 0;
          newInitials[selId] = { x: rendered.x, y: rendered.y, w: rendered.w, h: rendered.h, rotate };
        }
      });
      pointerState.current.initialPositions = newInitials;
    } else {
      // Selection Lasso Mode
      pointerState.current.mode = "lasso";
      const startX = (e.clientX - rect.left) / zoom;
      const startY = (e.clientY - rect.top) / zoom;
      pointerState.current.startX = startX;
      pointerState.current.startY = startY;
      setSelectionRect({ x: startX, y: startY, width: 0, height: 0 });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const { mode, startX, startY, initialPositions, startPanX, startPanY, resizeDir, resizeElementId } = pointerState.current;

    if (mode === "pan") {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      useEditorStore.getState().setCameraPan(startPanX + dx - useEditorStore.getState().camera.x, startPanY + dy - useEditorStore.getState().camera.y);
    } else if (mode === "resize") {
      pointerState.current.hasDragged = true;
      const zoom = useEditorStore.getState().camera.zoom;
      const dxScreen = (e.clientX - startX) / zoom;
      const dyScreen = (e.clientY - startY) / zoom;
      const id = resizeElementId;
      const init = initialPositions[id];
      if (!init) return;

      const MIN_SIZE = 20; // Минимальный размер элемента

      // Project dx and dy into the element's rotated coordinate space
      const angle = (init.rotate * Math.PI) / 180;
      const dx = dxScreen * Math.cos(angle) + dyScreen * Math.sin(angle);
      const dy = -dxScreen * Math.sin(angle) + dyScreen * Math.cos(angle);

      let newX = init.x;
      let newY = init.y;
      let newW = init.w;
      let newH = init.h;

      if (resizeDir === 'e') {
        newW = Math.max(MIN_SIZE, init.w + dx);
      } else if (resizeDir === 'w') {
        const deltaW = init.w - Math.max(MIN_SIZE, init.w - dx);
        newW = init.w - deltaW;
        newX = init.x + deltaW * Math.cos(angle);
        newY = init.y + deltaW * Math.sin(angle);
      } else if (resizeDir === 's') {
        newH = Math.max(MIN_SIZE, init.h + dy);
      } else if (resizeDir === 'n') {
        const deltaH = init.h - Math.max(MIN_SIZE, init.h - dy);
        newH = init.h - deltaH;
        newX = init.x - deltaH * Math.sin(angle);
        newY = init.y + deltaH * Math.cos(angle);
      } else if (resizeDir === 'se') {
        newW = Math.max(MIN_SIZE, init.w + dx);
        newH = Math.max(MIN_SIZE, init.h + dy);
      } else if (resizeDir === 'sw') {
        const deltaW = init.w - Math.max(MIN_SIZE, init.w - dx);
        newW = init.w - deltaW;
        newH = Math.max(MIN_SIZE, init.h + dy);
        newX = init.x + deltaW * Math.cos(angle);
        newY = init.y + deltaW * Math.sin(angle);
      } else if (resizeDir === 'ne') {
        newW = Math.max(MIN_SIZE, init.w + dx);
        const deltaH = init.h - Math.max(MIN_SIZE, init.h - dy);
        newH = init.h - deltaH;
        newX = init.x - deltaH * Math.sin(angle);
        newY = init.y + deltaH * Math.cos(angle);
      } else if (resizeDir === 'nw') {
        const deltaW = init.w - Math.max(MIN_SIZE, init.w - dx);
        const deltaH = init.h - Math.max(MIN_SIZE, init.h - dy);
        newW = init.w - deltaW;
        newH = init.h - deltaH;
        newX = init.x + deltaW * Math.cos(angle) - deltaH * Math.sin(angle);
        newY = init.y + deltaW * Math.sin(angle) + deltaH * Math.cos(angle);
      }

      // Гарантируем, что размеры положительные и достаточно большие
      newW = Math.max(MIN_SIZE, newW);
      newH = Math.max(MIN_SIZE, newH);

      const node = elementRefs.current[id];
      if (node) {
        node.style.width = `${newW}px`;
        node.style.height = `${newH}px`;
        node.style.transform = `translate(${newX - init.x}px, ${newY - init.y}px) rotate(${init.rotate}deg)`;
      }
    } else if (mode === "drag") {
      pointerState.current.hasDragged = true;
      const zoom = useEditorStore.getState().camera.zoom;
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;

      // Оптимизация: прямое обновление DOM для плавности (Draw.io style)
      Object.keys(initialPositions).forEach((id) => {
        const node = elementRefs.current[id];
        if (node) {
          const init = initialPositions[id];
          let newX = dx;
          let newY = dy;

          const el = elementsMap[id];
          if (el && el.parentKey && el.parentKey !== String(useEditorStore.getState().scene?.id)) {
            const parent = elementsMap[el.parentKey];
            if (parent && parent.type === 'group') {
              const renderedParent = getRenderedElement(parent);
              const pw = renderedParent.w ?? 0;
              const ph = renderedParent.h ?? 0;
              const maxDx = pw - init.w - init.x;
              const maxDy = ph - init.h - init.y;
              const minDx = -init.x;
              const minDy = -init.y;

              newX = Math.max(minDx, Math.min(dx, maxDx));
              newY = Math.max(minDy, Math.min(dy, maxDy));
            }
          }

          node.style.transform = `translate(${newX}px, ${newY}px) rotate(${init.rotate || 0}deg)`;
        }
      });
    } else if (mode === "lasso") {
      const rect = containerRef.current!.getBoundingClientRect();
      const zoom = useEditorStore.getState().camera.zoom;
      const currentX = (e.clientX - rect.left) / zoom;
      const currentY = (e.clientY - rect.top) / zoom;

      setSelectionRect({
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const { mode, initialPositions, hasDragged, startX, startY, resizeElementId, resizeDir } = pointerState.current;
    const elNode = (e.target as HTMLElement).closest(".scada-selectable");
    const resizeHandle = (e.target as HTMLElement).closest(".resize-handle");
    if (elNode) elNode.releasePointerCapture(e.pointerId);
    if (resizeHandle) resizeHandle.releasePointerCapture(e.pointerId);

    if (mode === "pan") {
      (e.currentTarget as HTMLElement).style.cursor = "crosshair";
    } else if (mode === "resize" && hasDragged) {
      const zoom = useEditorStore.getState().camera.zoom;
      const dxScreen = (e.clientX - startX) / zoom;
      const dyScreen = (e.clientY - startY) / zoom;
      const id = resizeElementId;
      const init = initialPositions[id];

      if (init) {
        const MIN_SIZE = 20;
        const angle = (init.rotate * Math.PI) / 180;
        const dx = dxScreen * Math.cos(angle) + dyScreen * Math.sin(angle);
        const dy = -dxScreen * Math.sin(angle) + dyScreen * Math.cos(angle);

        let newX = init.x;
        let newY = init.y;
        let newW = init.w;
        let newH = init.h;

        if (resizeDir === 'e') {
          newW = Math.max(MIN_SIZE, init.w + dx);
        } else if (resizeDir === 'w') {
          const deltaW = init.w - Math.max(MIN_SIZE, init.w - dx);
          newW = init.w - deltaW;
          newX = init.x + deltaW * Math.cos(angle);
          newY = init.y + deltaW * Math.sin(angle);
        } else if (resizeDir === 's') {
          newH = Math.max(MIN_SIZE, init.h + dy);
        } else if (resizeDir === 'n') {
          const deltaH = init.h - Math.max(MIN_SIZE, init.h - dy);
          newH = init.h - deltaH;
          newX = init.x - deltaH * Math.sin(angle);
          newY = init.y + deltaH * Math.cos(angle);
        } else if (resizeDir === 'se') {
          newW = Math.max(MIN_SIZE, init.w + dx);
          newH = Math.max(MIN_SIZE, init.h + dy);
        } else if (resizeDir === 'sw') {
          const deltaW = init.w - Math.max(MIN_SIZE, init.w - dx);
          newW = init.w - deltaW;
          newH = Math.max(MIN_SIZE, init.h + dy);
          newX = init.x + deltaW * Math.cos(angle);
          newY = init.y + deltaW * Math.sin(angle);
        } else if (resizeDir === 'ne') {
          newW = Math.max(MIN_SIZE, init.w + dx);
          const deltaH = init.h - Math.max(MIN_SIZE, init.h - dy);
          newH = init.h - deltaH;
          newX = init.x - deltaH * Math.sin(angle);
          newY = init.y + deltaH * Math.cos(angle);
        } else if (resizeDir === 'nw') {
          const deltaW = init.w - Math.max(MIN_SIZE, init.w - dx);
          const deltaH = init.h - Math.max(MIN_SIZE, init.h - dy);
          newW = init.w - deltaW;
          newH = init.h - deltaH;
          newX = init.x + deltaW * Math.cos(angle) - deltaH * Math.sin(angle);
          newY = init.y + deltaW * Math.sin(angle) + deltaH * Math.cos(angle);
        }

        // Гарантируем, что размеры положительные и достаточно большие
        newW = Math.max(MIN_SIZE, newW);
        newH = Math.max(MIN_SIZE, newH);

        newX = Math.round(newX / GRID) * GRID;
        newY = Math.round(newY / GRID) * GRID;
        newW = Math.max(GRID, Math.round(newW / GRID) * GRID);
        newH = Math.max(GRID, Math.round(newH / GRID) * GRID);

        const node = elementRefs.current[id];
        if (node) {
          node.style.width = '';
          node.style.height = '';
          node.style.transform = '';
        }

        useEditorStore.getState().updateElementVisual(id, { x: newX, y: newY, w: newW, h: newH });
      }
    } else if (mode === "drag" && hasDragged) {
      const zoom = useEditorStore.getState().camera.zoom;
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;

      Object.entries(initialPositions).forEach(([id, init]) => {
        const node = elementRefs.current[id];
        if (node) node.style.transform = ``;

        let newX = Math.round((init.x + dx) / GRID) * GRID;
        let newY = Math.round((init.y + dy) / GRID) * GRID;

        const el = elementsMap[id];
        if (el && el.parentKey && el.parentKey !== String(useEditorStore.getState().scene?.id)) {
          const parent = elementsMap[el.parentKey];
          if (parent && parent.type === 'group') {
            const renderedParent = getRenderedElement(parent);
            const pw = renderedParent.w ?? 0;
            const ph = renderedParent.h ?? 0;
            const maxDx = pw - init.w - init.x;
            const maxDy = ph - init.h - init.y;
            const minDx = -init.x;
            const minDy = -init.y;

            const constrainedDx = Math.max(minDx, Math.min(dx, maxDx));
            const constrainedDy = Math.max(minDy, Math.min(dy, maxDy));

            newX = Math.round((init.x + constrainedDx) / GRID) * GRID;
            newY = Math.round((init.y + constrainedDy) / GRID) * GRID;
          }
        }

        useEditorStore.getState().updateElementVisual(id, { x: newX, y: newY });
      });
    } else if (mode === "lasso") {
      if (selectionRect) {
        // Find elements inside the rect
        const selected = elements
          .filter(el => {
            const re = getRenderedElement(el);
            return isIntersecting(selectionRect, { x: re.x, y: re.y, w: re.w, h: re.h });
          })
          .map(el => el.key);
        selectMultiple(selected);
      }
      setSelectionRect(null);
    }

    pointerState.current.mode = "idle";
    pointerState.current.hasDragged = false;
  };

  const elementsMap = useMemo(() => {
    const map: Record<string, DiagramElement> = {};
    elements.forEach(el => map[el.key] = el);
    return map;
  }, [elements]);

  const renderElement = (el: DiagramElement, isInsideGroup = false) => {
    if (el.type === 'line') return null;
    const isSelected = selectedIds.includes(el.key);
    const renderedElement = getRenderedElement(el);
    const rotate = (renderedElement as LeafElement).rotate || 0;
    const posSizeStyle = {
      left: renderedElement.x,
      top: renderedElement.y,
      width: renderedElement.w,
      height: renderedElement.h,
      transform: `rotate(${rotate}deg)`,
      transformOrigin: '50% 50%',
    };

    const renderResizeHandles = () => {
      if (!isSelected) return null;
      return (
        <>
          <div data-direction="nw" className="absolute top-[-5px] left-[-5px] w-2.5 h-2.5 bg-white border border-blue-500 resize-handle cursor-nwse-resize z-20" style={{ pointerEvents: 'auto' }} />
          <div data-direction="ne" className="absolute top-[-5px] right-[-5px] w-2.5 h-2.5 bg-white border border-blue-500 resize-handle cursor-nesw-resize z-20" style={{ pointerEvents: 'auto' }} />
          <div data-direction="se" className="absolute bottom-[-5px] right-[-5px] w-2.5 h-2.5 bg-white border border-blue-500 resize-handle cursor-nwse-resize z-20" style={{ pointerEvents: 'auto' }} />
          <div data-direction="sw" className="absolute bottom-[-5px] left-[-5px] w-2.5 h-2.5 bg-white border border-blue-500 resize-handle cursor-nesw-resize z-20" style={{ pointerEvents: 'auto' }} />
        </>
      );
    };

    const handleFaceplate = async () => {
      const rootElement = elements.find(element => element.key === el.key);
      if (!rootElement) return;

      const allDescendants = getDescendants(rootElement.key, elements);

      const faceplate = [rootElement, ...allDescendants];

      OpenCreateFaceplateModal(faceplate);
    }

    if (el.type === "group") {
      const group = el as GroupElement;

      const groupLines = group.children
        .map(childId => elementsMap[childId])
        .filter(child => child?.type === 'line');

      return (
        <DynamicContextMenu
          key={el.key}
          items={[
            {label: 'Добавить свойство', onClick: () => handleAddProperty(el.id), disabled: !el.id},
            {label: 'Сохранить в палитру', onClick: handleFaceplate},
            {label: 'Удалить группу', onClick: () => console.log('Del Group'), variant: 'danger'}
          ]}
        >
            <div
              ref={node => { elementRefs.current[el.key] = node; }}
              data-id={el.key}
              className={cn(
                "absolute scada-selectable group-element rounded-lg border-2 box-border select-none touch-none",
                isSelected ? "border-blue-500 bg-blue-900/30 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]" : "border-blue-700/50 bg-blue-950/20"
              )}
              style={{ ...posSizeStyle, borderStyle: group.borderStyle || "dashed", pointerEvents: "auto" }}
            >
              {group.children.map((childId) => {
                const child = elementsMap[childId];
                if (!child) return null;
                return (
                  <React.Fragment key={child.key}>
                    {renderElement(child, true)}
                  </React.Fragment>
                );
              })}

              {groupLines.length > 0 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
                  {groupLines.map(line => (
                    <Line key={line.key} element={line as LeafElement} onSelect={handleSelect} />
                  ))}
                </svg>
              )}
              {renderResizeHandles()}
            </div>
        </DynamicContextMenu>
      );
    }

    // Обычный элемент (лист)
    const nodeContent = (
      <div
        ref={node => { elementRefs.current[el.key] = node; }}
        data-id={el.key}
        className={cn(
          "absolute scada-selectable child-element z-10 select-none touch-none hover:ring-1 hover:ring-blue-400/50",
          isSelected ? "shadow-xl ring-2 ring-blue-500" : "shadow-sm"
        )}
        style={{ ...posSizeStyle, pointerEvents: "auto" }}
      >
        <NodeElement element={el as LeafElement} isSelected={isSelected} />
        {renderResizeHandles()}
      </div>
    );

    if (isInsideGroup) {
      return (
        <DynamicContextMenu key={el.key} items={[
          {label: 'Добавить свойство', onClick: () => handleAddProperty(el.id), disabled: !el.id},
          ...editorElementMenuItems,
        ]}>
          {nodeContent}
        </DynamicContextMenu>
      );
    }

    return (
      <DynamicContextMenu key={el.key} items={[
        {label: 'Добавить свойство', onClick: () => handleAddProperty(el.id), disabled: !el.id},
        ...editorElementMenuItems,
      ]}>
        {nodeContent}
      </DynamicContextMenu>
    );
  };

  return (
    <div
      id="canvas-viewport"
      className="relative w-full h-full overflow-hidden touch-none bg-neutral-950"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <DynamicContextMenu items={[
        { label: 'Вставить элемент', onClick: () => console.log('Paste') },
        { label: 'Очистить холст', onClick: () => console.log('Clear'), variant: 'danger' }
      ]}>
        <div
          id="canvas-scene"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            transformOrigin: '0 0',
            width: `${CANVAS_WIDTH}px`,
            height: `${CANVAS_HEIGHT}px`,
            overflow: 'visible',
            touchAction: 'none'
          }}
          ref={(node) => {
            setNodeRef(node);
            containerRef.current = node;
          }}
          className="select-none touch-none absolute"
        >
          {/* Фоновая сетка */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
            linear-gradient(to right, rgba(60,60,70,0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(60,60,70,0.4) 1px, transparent 1px)
          `,
              backgroundSize: `${GRID}px ${GRID}px`,
            }}
          />

          {/* 1 слой — линии */}
          <LinesLayer onSelect={handleSelect}/>

          {/* 2 слой — элементы */}
          {rootElements.map(el => (
            <React.Fragment key={el.key}>
              {renderElement(el)}
            </React.Fragment>
          ))}


          {/* Подсказка, если canvas пустой */}
          {rootElements.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center text-neutral-600 pointer-events-none text-sm">
              Перетащите элемент из палитры сюда
            </div>
          )}

          {/* Рамка выделения */}
          {selectionRect && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height,
                backgroundColor: "rgb(0, 150, 255, 0.2)",
                border: "1px solid #0096ff",
              }}
            />
          )}
        </div>
      </DynamicContextMenu>
    </div>
  )
}