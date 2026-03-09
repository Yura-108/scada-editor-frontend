import {LeafElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";
import React, {useCallback, useEffect, useState} from "react";

interface Props {
  element: LeafElement;
  onSelect: (id: string, e: React.MouseEvent) => void;
}

export const Line = React.memo(function Line({ element, onSelect}: Props) {
  const { selectedIds, updateElement } = useEditorStore();
  const selected = selectedIds.includes(element.key);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const onStartDown = useCallback((e: React.PointerEvent) => handlePointerDown(e, "start"), []);
  const onEndDown = useCallback((e: React.PointerEvent) => handlePointerDown(e, "end"), []);


  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaX = e.movementX;
      const deltaY = e.movementY;

      if (dragging === "start") {
        updateElement(element.key, {
          x1: (element.x1 ?? 100) + deltaX,
          y1: (element.y1 ?? 100) + deltaY,
        });
      } else {
        updateElement(element.key, {
          x2: (element.x2 ?? 100) + deltaX,
          y2: (element.y2 ?? 100) + deltaY,
        });
      }
    };

    const handlePointerUp = () => {
      setDragging(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, element.x1, element.x2, element.y1, element.y2]);


  const handlePointerDown = (e: React.PointerEvent, point: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(point);
  };



  return (
    <g
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(element.key, e)
      }}
    >
      <line
        x1={element.x1}
        y1={element.y1}
        x2={element.x2}
        y2={element.y2}
        stroke="#9ca3af"
        strokeWidth={2}
      />

      {selected && (
        <>
          <circle
            className="no-drag"
            cx={element.x1}
            cy={element.y1}
            r={6}
            fill="#3b82f6"
            style={{ cursor: "pointer"}}
            onPointerDown={onStartDown}
          />

          <circle
            className="no-drag"
            cx={element.x2}
            cy={element.y2}
            r={6}
            fill="#3b82f6"
            style={{ cursor: "pointer" }}
            onPointerDown={onEndDown}
          />
        </>
      )}
    </g>
  )
});