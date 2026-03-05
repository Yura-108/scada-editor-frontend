"use client";

import React, {useMemo, useRef, useEffect, useCallback, useState} from "react";
import { Rnd } from "react-rnd";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "@/store/useEditorStore";
import { GRID } from "@/lib/utils";
import NodeElement from "@/components/NodeElement";
import {DiagramElement, GroupElement, LeafElement} from "@/types/editorElement.type";
import {cn} from "@/lib/utils"
import isIntersecting from "@/lib/isIntersecting";
import {Save} from "lucide-react";

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
    exportScene
  } = useEditorStore();

  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionStart, setSelectionStart] = useState<{x: number; y: number} | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const { setNodeRef } = useDroppable({ id: "canvas" });
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

  // useEffect(() => {
  //   const selectedElements = elements.filter(el => selectedIds.includes(el.key));
  //
  //   if (selectedElements.length > 0) {
  //     selectedElements.forEach(el => {
  //       if (el.type === "line") {
  //         setSelectionRect(getLineBoundingBox(el));
  //       } else {
  //         setSelectionRect({
  //           x: el.x,
  //           y: el.y,
  //           width: el.w,
  //           height: el.h
  //         })
  //       }
  //     })
  //   }
  //}, [selectedIds, elements]);

  const rootElements = useMemo(
    () => elements.filter(el => !el.parentKey),
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
  }

  const elementsMap = useMemo(() => {
    const map: Record<string, DiagramElement> = {};
    elements.forEach(el => map[el.key] = el);
    return map;
  }, [elements]);

  const handleSelect = useCallback((id: string, e: MouseEvent) => {
    if (e.shiftKey) {
      const newSelection = selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id];
      selectMultiple(newSelection);
    } else {
      selectMultiple([id]);
    }
  }, [selectedIds, selectMultiple]);

  const renderElement = (el: DiagramElement) => {
    const isSelected = selectedIds.includes(el.key);

    if (el.type === "group") {
      const group = el as GroupElement;

      return (
        <Rnd
          key={el.key}
          size={{ width: el.w, height: el.h }}
          position={{ x: el.x, y: el.y }}
          bounds="parent"
          dragGrid={[GRID, GRID]}
          resizeGrid={[GRID, GRID]}
          cancel=".no-drag, input, textarea, button, .child-element"
          onDragStop={(_, d) => {
            updateElement(el.key, {
              x: d.x,
              y: d.y
            });
          }}
          onResizeStop={(_, __, ref, ___, pos) =>
            updateElement(el.key, {
              w: parseFloat(ref.style.width),
              h: parseFloat(ref.style.height),
              x: pos.x,
              y: pos.y,
            })
          }
          onMouseDown={(e) => {
            e.stopPropagation();

            const isChildClicked = (e.target as HTMLElement).closest('.child-element');

            if (!isChildClicked) {
              handleSelect(el.key, e);
            }
          }}
        >
          <div
            className={cn(
              "w-full h-full relative rounded-lg border-2",
              isSelected
                ? "border-blue-500 bg-blue-900/30 ring-2 ring-blue-400/60"
                : "border-blue-700/50 bg-blue-950/20 hover:bg-blue-950/30",
              "transition-all duration-150 overflow-hidden"
            )}
            style={{
              borderStyle: group.borderStyle || "dashed",
              borderColor: group.borderColor || "#60a5fa",
              backgroundColor: el.bg || "rgba(59,130,246,0.08)",
            }}
          >
            {group.children.map((childId) => {
              const child = elementsMap[childId];
              if (!child) return null;
              return renderElement(child);
            })}
          </div>
        </Rnd>
      );
    }

    // Обычный элемент (лист)
    return (
      <Rnd
        key={el.key}
        size={{ width: el.w, height: el.h }}
        position={{ x: el.x, y: el.y }}
        bounds={"parent"}
        dragGrid={[GRID, GRID]}
        resizeGrid={[GRID, GRID]}
        cancel=".no-drag, input, textarea, button"
        onDragStop={(_, d) => {
          updateElement(el.key, {
            x: d.x ,
            y: d.y,
          });
        }}
        onResizeStop={(_, __, ref, ___, pos) => {
          updateElement(el.key, {
            w: parseFloat(ref.style.width),
            h: parseFloat(ref.style.height),
            x: pos.x ,
            y: pos.y ,
          });
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleSelect(el.key, e)
        }}
        className={cn(
          "child-element z-10 transition-shadow duration-150",
          isSelected ? "shadow-lg" : "shadow-sm",
          "hover:shadow-[0_0_0_2px_#60a5fa80]"
        )}
      >
        <NodeElement
          element={el as LeafElement} isSelected={isSelected} />
      </Rnd>
    );
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        containerRef.current = node;
      }}
      className={`
        relative flex-1 min-w-[640px] min-h-[680px]
        bg-neutral-950
        overflow-hidden
        select-none
        touch-none
      `}
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

      {/* Кнопки */}
      <div className="absolute top-16 right-8 flex flex-col gap-3">
        <button
          onClick={() => useEditorStore.getState().groupSelected()}
          disabled={selectedIds.length < 2}
          className="group relative px-4 py-2 text-sm font-medium rounded-xl
               bg-white/10 backdrop-blur-md border border-white/20
               text-white
               hover:bg-white/20 hover:border-white/30
               active:shadow-none active:translate-y-0.5
               disabled:opacity-30 disabled:pointer-events-none disabled:translate-y-0
               transition-all duration-150 ease-out"
        >
          Сгруппировать
        </button>

        <button
          onClick={() => useEditorStore.getState().ungroupSelected()}
          disabled={!selectedIds.some(id => {
            const el = useEditorStore.getState().elements.find(e => e.key === id);
            return el?.type === "group";
          })}
          className="group relative px-4 py-2 text-sm font-medium rounded-xl
               bg-white/10 backdrop-blur-md border border-white/20
               text-white
               hover:bg-white/20 hover:border-white/30
               active:shadow-none active:translate-y-0.5
               disabled:opacity-30 disabled:pointer-events-none disabled:translate-y-0
               transition-all duration-150 ease-out"
        >
          Разгруппировать
        </button>

        <button
          onClick={exportScene}
          className="group relative flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-xl
               bg-indigo-500/30 backdrop-blur-lg border border-indigo-400/40
               text-indigo-100
               hover:bg-indigo-500/40 hover:border-indigo-400/60
               active:shadow-none active:translate-y-0.5
               transition-all duration-150 ease-out"
        >
          <Save size={16} strokeWidth={2.5} />
          Сохранить
        </button>
      </div>

      {/* Узлы */}
      {rootElements.map(el => renderElement(el))}

      {/* Подсказка, если canvas пустой */}
      {rootElements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-600 pointer-events-none text-sm">
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
  );
}

