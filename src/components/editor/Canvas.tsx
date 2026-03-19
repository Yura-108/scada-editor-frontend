"use client";

import React, {useMemo, useRef, useEffect, useCallback, useState} from "react";
import {Rnd} from "react-rnd";
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
import {OpenChooseTagModal} from "@/components/ui/OpenChooseTagModal";

export default function Canvas() {
  const {
    elements,
    updateElement,
    selectedIds,
    selectMultiple,
    setCanvasRect,
    deleteSelectedElement,
    copySelectedElement,
    pasteSelectedElement,
    camera,
    scene,
  } = useEditorStore();

  console.log(elements);

  const CANVAS_WIDTH = 5000;
  const CANVAS_HEIGHT = 5000;

  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const {setNodeRef} = useDroppable({id: "canvas"});
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".scada-element")) return;
    if ((e.target as HTMLElement).closest("button")) return;

    const rect = containerRef.current!.getBoundingClientRect();

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setIsSelecting(true);
    setSelectionStart({x: startX, y: startY});
    setSelectionRect({
      x: startX,
      y: startY,
      width: 0,
      height: 0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart) return;

    const rect = containerRef.current!.getBoundingClientRect();

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(selectionStart.x, currentX);
    const y = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);

    setSelectionRect({x, y, width, height});
  }

  const handleMouseUp = () => {
    if (!selectionRect) return;

    const selected = elements
      .filter(el => isIntersecting(selectionRect, el))
      .map(el => el.key);

    selectMultiple(selected);

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionRect(null);
  };

  const handleContextMenu = (e: React.MouseEvent, elId: string) => {
    if (!selectedIds.includes(elId)) {
      handleSelect(elId, e);
    }
  };

  const handleSelect = useCallback((id: string, e: React.MouseEvent | MouseEvent) => {
    if (e.shiftKey) {
      const newSelection = selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id];
      selectMultiple(newSelection);
    } else {
      selectMultiple([id]);
    }
  }, [selectedIds, selectMultiple]);

  const panZoomHandlers = {
    // 1. ПЕРЕМЕЩЕНИЕ (PAN)
    onPointerMove: (e: React.PointerEvent) => {
      // Проверяем, зажато ли колесико мыши (button 1 или buttons 4)
      // Либо можно проверять зажатый пробел + левую кнопку
      if (e.buttons === 4) {
        const {setCameraPan} = useEditorStore.getState();
        // Двигаем камеру на столько же, на сколько сдвинулась мышь
        setCameraPan(e.movementX, e.movementY);
      }
    },
    // Чтобы курсор менялся на «руку» при зажатом колесике
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button === 1) { // 1 — это колесико
        (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
      }
    },

    onPointerUp: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).style.cursor = 'crosshair';
    }
  };

  const elementsMap = useMemo(() => {
    const map: Record<string, DiagramElement> = {};
    elements.forEach(el => map[el.key] = el);
    return map;
  }, [elements]);

  const renderElement = (el: DiagramElement, isInsideGroup = false) => {
    if (el.type === 'line') return null;
    const isSelected = selectedIds.includes(el.key);

    const handleFaceplate = async () => {
      const rootElement = elements.find(element => element.key === el.key);
      if (!rootElement) return;

      const allDescendants = getDescendants(rootElement.key, elements);

      const faceplate = [rootElement, ...allDescendants];

      OpenCreateFaceplateModal(faceplate);
    }

    const handleBindTag = () => {
      if (!el.id) return;
      OpenChooseTagModal(el.id);
    }

    // Общие пропсы для Rnd
    const rndProps = {
      size: { width: el.w, height: el.h },
      position: { x: el.x, y: el.y },
      dragGrid: [GRID, GRID] as [number, number],
      resizeGrid: [GRID, GRID] as [number, number],
      bounds: "parent",
      onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, el.key),
      onDragStop: (_: any, d: any) => updateElement(el.key, { x: d.x, y: d.y }),
      onResizeStop: (_: any, __: any, ref: any, ___: any, pos: any) =>
        updateElement(el.key, {
          w: parseFloat(ref.style.width),
          h: parseFloat(ref.style.height),
          x: pos.x,
          y: pos.y,
        }),
    };

    if (el.type === "group") {
      const group = el as GroupElement;

      return (
        <DynamicContextMenu
          key={el.key}
          items={[
            {label: 'Добавить свойство', onClick: handleBindTag, disabled: !el.id},
            {label: 'Сохранить в палитру', onClick: handleFaceplate},
            {label: 'Удалить группу', onClick: () => console.log('Del Group'), variant: 'danger'}
          ]}
        >
          <Rnd
            {...rndProps}
            key={el.key}
            cancel=".no-drag, .child-element"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!(e.target as HTMLElement).closest('.child-element')) {
                handleSelect(el.key, e);
              }
            }}
          >
            <div
              className={cn(
                "w-full h-full relative rounded-lg border-2 p-4 box-border",
                isSelected ? "border-blue-500 bg-blue-900/30" : "border-blue-700/50 bg-blue-950/20"
              )}
              style={{ borderStyle: group.borderStyle || "dashed" }}
            >
              {group.children.map((childId) => {
                const child = elementsMap[childId];
                if (!child) return null;
                // Передаем флаг, что элемент внутри группы
                return renderElement(child, true);
              })}
            </div>
          </Rnd>
        </DynamicContextMenu>
      );
    }

    // Обычный элемент (лист)
    const nodeContent = (
      <Rnd
        {...rndProps}
        key={el.key}
        className={cn("child-element z-10 box-border", isSelected ? "shadow-lg" : "shadow-sm")}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleSelect(el.key, e);
        }}
      >
        <NodeElement element={el as LeafElement} isSelected={isSelected} />
      </Rnd>
    );

    if (isInsideGroup) {
      return nodeContent;
    }

    return (
      <DynamicContextMenu key={el.key} items={[
        {label: 'Добавить свойство', onClick: handleBindTag, disabled: !el.id},
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
      {...panZoomHandlers}
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
          }}
          ref={(node) => {
            setNodeRef(node);
            containerRef.current = node;
          }}
          className="select-none touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
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
          {rootElements.map(el => renderElement(el))}


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

