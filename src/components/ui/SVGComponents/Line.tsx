import {LeafElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";
import React, {useCallback, useEffect, useState} from "react";

interface Props {
  element: LeafElement;
  onSelect: (id: string, e: React.MouseEvent) => void;
}

export const Line = React.memo(function Line({ element, onSelect}: Props) {
  const { selectedIds, updateElementVisual, camera } = useEditorStore();
  const selected = selectedIds.includes(element.key);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const zoom = camera.zoom || 1;
      const deltaX = e.movementX / zoom;
      const deltaY = e.movementY / zoom;

      let newX1 = element.x1 ?? 100;
      let newY1 = element.y1 ?? 100;
      let newX2 = element.x2 ?? 100;
      let newY2 = element.y2 ?? 100;

      if (dragging === "start") {
        newX1 += deltaX;
        newY1 += deltaY;
      } else {
        newX2 += deltaX;
        newY2 += deltaY;
      }

      updateElementVisual(element.key, {
        x1: newX1,
        y1: newY1,
        x2: newX2,
        y2: newY2,
        x: (newX1 + newX2) / 2,
        y: (newY1 + newY2) / 2,
      })
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
  }, [camera.zoom, dragging, element.x1, element.x2, element.y1, element.y2, element.key, updateElementVisual]);

  const handlePointerDown = (e: React.PointerEvent, point: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(point);
  };

  const onStartDown = useCallback((e: React.PointerEvent) => handlePointerDown(e, "start"), []);
  const onEndDown = useCallback((e: React.PointerEvent) => handlePointerDown(e, "end"), []);

  return (
    <g
      className="pointer-events-auto"
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
        stroke="#270a1f"
        strokeWidth={4}
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