import getTransform from "@/lib/getTransform";
import {LeafElement} from "@/types/editorElement.type";
import React, {useEffect, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";

interface LineProps {
  element: LeafElement;
}

export default function Line({ element }: LineProps) {
  const [draggingPoint, setDraggingPoint] = useState<'start' | 'end' | null>(null);
  const {updateElement, selectedIds} = useEditorStore();

  const x1 = element.x1 ?? 10;
  const y1 = element.y1 ?? 40;
  const x2 = element.x2 ?? 70;
  const y2 = element.y2 ?? 40;

  useEffect(() => {
    if (!draggingPoint) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.movementX;
      const deltaY = e.movementY;

      if (draggingPoint === "start") {
        updateElement(element.key, {
          x1: x1 + deltaX,
          y1: y1 + deltaY,
        });
      } else if (draggingPoint === "end") {
        updateElement(element.key, {
          x2: x2 + deltaX,
          y2: y2 + deltaY,
        });
      }
    };

    const handleMouseUp = () => {
      setDraggingPoint(null)
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingPoint, element.id, x1, y1, x2, y2]);

  const handlePointerDown = (e: React.PointerEvent, point: 'start' | 'end') => {
    e.stopPropagation(); // Останавливает React-события
    setDraggingPoint(point);
  };

  return (
    <svg width={element.h} height={element.h} viewBox={`0 0 ${element.w} ${element.h}`}>
      <g
        transform={getTransform(element)}
        opacity={element.opacity ?? 1}
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={element.strokeColor ?? "#9ca3af"}
          strokeWidth={element.strokeWidth ?? 3}
          strokeDasharray={element.strokeDasharray ?? ""}
        />

        {element.arrowEnd && (
          <ArrowHead x1={x1} y1={y1} x2={x2} y2={y2} color={element.strokeColor ?? "#9ca3af"} />
        )}

        {selectedIds.includes(element.key) && (
          <>
            {/* Левый конец */}
            <circle
              className="no-drag"
              cx={x1}
              cy={y1}
              r={6}
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth={2}
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => handlePointerDown(e, 'start')}
            />
            {/* Правый конец */}
            <circle
              className="no-drag"
              cx={x2}
              cy={y2}
              r={6}
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth={2}
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => handlePointerDown(e, 'end')}
            />
          </>
        )}
      </g>
    </svg>
  );
}

function ArrowHead({ x1, y1, x2, y2, color }: { x1: number, y1: number, x2: number, y2: number, color: string }) {
  // Вычисляем угол поворота линии
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  return (
    <polygon
      // Отрисовываем стрелку в начале координат (0,0) и сдвигаем/поворачиваем куда надо
      points="-10,-5 0,0 -10,5"
      fill={color}
      transform={`translate(${x2}, ${y2}) rotate(${angle})`}
    />
  );
}