"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import { Rnd } from "react-rnd";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "@/store/useEditorStore";
import { GRID, snap } from "@/lib/utils";
import NodeElement from "@/components/NodeElement";
import { BaseElement, Port } from "@/types/editorElement.type";
import {cn} from "@/lib/utils"


export default function Canvas() {
  const {
    elements,
    updateElement,
    select,
    selectedIds,
    setSelectedId,
    selectMultiple,
    groupSelected,
    ungroupSelected,
    setCanvasRect,
    deleteSelectedElement,
    copySelectedElement,
    pasteSelectedElement,
    connecting,
    startConnection,
    updateConnectionPosition,
    finishConnection,
    cancelConnection,
  } = useEditorStore();

  const { setNodeRef } = useDroppable({ id: "canvas" });
  const containerRef = useRef<HTMLDivElement>(null);

  // Обновление размеров и позиции канваса
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

  const nodes = useMemo(() => elements.filter((el) => el.type !== "connection"), [elements]);
  const connections = useMemo(() => elements.filter((el) => el.type === "connection"), [elements]);

  function getPortCoords(node: BaseElement, port: Port) {
    switch (port.position) {
      case "top":    return { x: node.x + node.w / 2, y: node.y };
      case "right":  return { x: node.x + node.w,     y: node.y + node.h / 2 };
      case "bottom": return { x: node.x + node.w / 2, y: node.y + node.h };
      case "left":   return { x: node.x,              y: node.y + node.h / 2 };
      default:       return { x: node.x,              y: node.y };
    }
  }

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      const newSelection = selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id];
      selectMultiple(newSelection);
    } else {
      selectMultiple([id]);
    }
  }, [selectedIds, selectMultiple]);

  const renderElement = (el: DiagramElement, parentOffsetX = 0, parentOffsetY = 0) => {
    const isSelected = selectedIds.includes(el.id);
    const absoluteX = el.parentId ? parentOffsetX + el.x : el.x;
    const absoluteY = el.parentId ? parentOffsetY + el.y : el.y;

    if (el.type === "group") {
      const group = el as GroupElement;

      return (
        <Rnd
          key={el.id}
          size={{ width: el.w, height: el.h }}
          position={{ x: absoluteX, y: absoluteY }}
          bounds="parent"
          dragGrid={[GRID, GRID]}
          resizeGrid={[GRID, GRID]}
          cancel=".port, input, textarea, button, .child-element"
          onDragStop={(_, d) => {
            updateElement(el.id, { x: snap(d.x), y: snap(d.y) })
          }}
          onResizeStop={(_, __, ref, ___, pos) =>
            updateElement(el.id, {
              w: Math.round(parseFloat(ref.style.width)),
              h: Math.round(parseFloat(ref.style.height)),
              x: snap(pos.x),
              y: snap(pos.y),
            })
          }
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              handleSelect(el.id, e)
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
            {/* Рекурсивный рендер детей с offset'ом от группы */}
            {group.children.map((childId) => {
              const child = elements.find((e) => e.id === childId);
              if (!child || child.type === "connection") return null;
              // Передаем абсолютные координаты группы как parentOffset для детей
              return renderElement(child, absoluteX, absoluteY);
            })}
          </div>
        </Rnd>
      );
    }

    // Обычный элемент (лист)
    return (
      <Rnd
        key={el.id}
        size={{ width: el.w, height: el.h }}
        position={{ x: absoluteX, y: absoluteY }}
        bounds={el.parentId ? "parent" : "parent"}
        dragGrid={[GRID, GRID]}
        resizeGrid={[GRID, GRID]}
        cancel=".port, input, textarea, button"
        onDragStop={(_, d) => {
          if (el.parentId) {
            // Если у элемента есть родитель, обновляем его координаты ОТНОСИТЕЛЬНО родителя
            const parent = elements.find(e => e.id === el.parentId);
            if (parent) {
              // d.x и d.y - это абсолютные координаты на канвасе
              // Преобразуем их в относительные координаты внутри группы
              const relativeX = d.x - parent.x;
              const relativeY = d.y - parent.y;

              // Проверяем, что элемент не выходит за границы группы
              const boundedX = Math.max(0, Math.min(relativeX, parent.w - el.w));
              const boundedY = Math.max(0, Math.min(relativeY, parent.h - el.h));

              updateElement(el.id, {
                x: snap(boundedX),
                y: snap(boundedY)
              });
            }
          } else {
            // Если нет родителя - абсолютные координаты
            updateElement(el.id, {x: snap(d.x), y: snap(d.y)})
          }
        }}
        onResizeStop={(_, __, ref, ___, pos) => {
          if (el.parentId) {
            const parent = elements.find(e => e.id === el.parentId);
            if (parent) {
              updateElement(el.id, {
                w: Math.round(parseFloat(ref.style.width)),
                h: Math.round(parseFloat(ref.style.height)),
                x: snap(pos.x - parent.x),
                y: snap(pos.y - parent.y),
              });
            }
          } else {
            updateElement(el.id, {
              w: Math.round(parseFloat(ref.style.width)),
              h: Math.round(parseFloat(ref.style.height)),
              x: snap(pos.x),
              y: snap(pos.y),
            });
          }
        }}
        onMouseDown={(e) => handleSelect(el.id, e)}
        className={cn(
          "child-element z-10 transition-shadow duration-150",
          isSelected ? "shadow-lg" : "shadow-sm",
          "hover:shadow-[0_0_0_2px_#60a5fa80]"
        )}
      >
        <NodeElement
          element={el}
          isSelected={isSelected}
          onMouseDownPort={(portId) => startConnection(el.id, portId)}
          onMouseUpPort={(portId) => finishConnection(el.id, portId)}
        />
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
      onMouseMove={(e) => {
        if (!connecting || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        updateConnectionPosition(
          Math.round(e.clientX - rect.left),
          Math.round(e.clientY - rect.top)
        );
      }}
      onMouseUp={() => connecting && cancelConnection()}
      onMouseDown={(e) => {
        if (e.button !== 0) return;

        if (e.target === e.currentTarget) {
          selectMultiple([]);
        }
      }}
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

      {/* Соединения (SVG слой) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        style={{ minWidth: "100%", minHeight: "100%" }}
      >
        {/* Постоянные связи */}
        {connections.map((conn) => {
          const fromNode = nodes.find((n) => n.id === conn.fromNode);
          const toNode   = nodes.find((n) => n.id === conn.toNode);
          if (!fromNode || !toNode) return null;

          const fromPort = fromNode.ports?.find((p) => p.id === conn.fromPort);
          const toPort   = toNode.ports?.find((p) => p.id === conn.toPort);
          if (!fromPort || !toPort) return null;

          const start = getPortCoords(fromNode, fromPort);
          const end   = getPortCoords(toNode,   toPort);

          return (
            <line
              key={conn.id}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#64748b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Временная связь при перетаскивании */}
        {connecting && (() => {
          const fromNode = nodes.find((n) => n.id === connecting.fromNode);
          if (!fromNode) return null;

          const fromPort = fromNode.ports?.find((p) => p.id === connecting.fromPort);
          if (!fromPort) return null;

          const start = getPortCoords(fromNode, fromPort);

          return (
            <line
              x1={start.x}
              y1={start.y}
              x2={connecting.mouseX}
              y2={connecting.mouseY}
              stroke="#60a5fa"
              strokeWidth="3"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          );
        })()}
      </svg>

      {/* Узлы */}
      {elements.filter(el => el.type !== "connection")
        .map(el => renderElement(el))}

      {/* Подсказка, если канвас пустой */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-600 pointer-events-none text-sm">
          Перетащите элемент из палитры сюда
        </div>
      )}
    </div>
  );
}

