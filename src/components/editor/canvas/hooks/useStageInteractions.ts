import { RefObject, useEffect, useRef, useState } from "react";
import Konva from "konva";
import { useEditorStore } from "@/store/useEditorStore";
import { DiagramElement } from "@/types/editorElement.type";
import isIntersecting from "@/lib/isIntersecting";
import { getSelectionBounds } from "@/lib/editor/getSelectionBounds";
import type { SelectionRect } from "../types";

interface StageInteractionsDeps {
  stageRef: RefObject<Konva.Stage | null>;
  camera: { x: number; y: number; zoom: number };
  setCameraPan: (dx: number, dy: number) => void;
  setCameraZoom: (zoom: number) => void;
  elements: DiagramElement[];
  elementsMap: Record<string, DiagramElement>;
  selectedIds: string[];
  selectMultiple: (ids: string[]) => void;
  activeGroupKey: string | null;
  exitGroup: () => void;
  closeMenu: () => void;
}

/**
 * Инкапсулирует взаимодействия со Stage: зум по Ctrl+колесо, панорамирование
 * (Shift+колесо / просто колесо / средняя кнопка мыши) и рамку выделения.
 */
export function useStageInteractions({
  stageRef,
  camera,
  setCameraPan,
  setCameraZoom,
  elements,
  elementsMap,
  selectedIds,
  selectMultiple,
  activeGroupKey,
  exitGroup,
  closeMenu,
}: StageInteractionsDeps) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const middlePanRef = useRef<{ x: number; y: number } | null>(null);

  // Панорамирование средней кнопкой — нативные window-события, чтобы drag
  // работал и за пределами холста.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!middlePanRef.current) return;
      const dx = e.clientX - middlePanRef.current.x;
      const dy = e.clientY - middlePanRef.current.y;
      middlePanRef.current = { x: e.clientX, y: e.clientY };
      useEditorStore.getState().setCameraPan(dx, dy);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1 && middlePanRef.current) {
        middlePanRef.current = null;
        const container = stageRef.current?.container();
        if (container) container.style.cursor = "default";
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [stageRef]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    if (e.evt.ctrlKey) {
      // Ctrl + Wheel → zoom to cursor point
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const zoomSensitivity = 0.001;
      const newZoom = Math.min(Math.max(oldScale + (-e.evt.deltaY * zoomSensitivity), 0.2), 3);

      setCameraZoom(newZoom);
      setCameraPan(
        pointer.x - mousePointTo.x * newZoom - camera.x,
        pointer.y - mousePointTo.y * newZoom - camera.y,
      );
    } else if (e.evt.shiftKey) {
      setCameraPan(-e.evt.deltaY, 0);
    } else {
      setCameraPan(-e.evt.deltaX, -e.evt.deltaY);
    }
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    closeMenu();
    const clickedOnEmpty = e.target === e.target.getStage();
    const clickedOnBg = e.target.name() === "grid-bg";

    // Средняя кнопка → старт панорамирования
    if (e.evt instanceof MouseEvent && e.evt.button === 1) {
      middlePanRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      const container = stageRef.current?.container();
      if (container) container.style.cursor = "grabbing";
      return;
    }

    if (clickedOnEmpty || clickedOnBg) {
      if (activeGroupKey) {
        exitGroup();
      } else if (!e.evt.shiftKey && !e.evt.ctrlKey) {
        selectMultiple([]);
      }
      const pos = stageRef.current?.getPointerPosition();
      if (pos && stageRef.current) {
        setSelectionRect({
          x: (pos.x - stageRef.current.x()) / stageRef.current.scaleX(),
          y: (pos.y - stageRef.current.y()) / stageRef.current.scaleX(),
          width: 0,
          height: 0,
        });
      }
    }
  };

  const handleStageMouseMove = () => {
    if (selectionRect && stageRef.current) {
      const pos = stageRef.current.getPointerPosition();
      if (pos) {
        const rx = (pos.x - stageRef.current.x()) / stageRef.current.scaleX();
        const ry = (pos.y - stageRef.current.y()) / stageRef.current.scaleX();
        setSelectionRect(prev => prev ? { x: prev.x, y: prev.y, width: rx - prev.x, height: ry - prev.y } : null);
      }
    }
  };

  const handleStageMouseUp = () => {
    if (!selectionRect) return;

    const sx = Math.min(selectionRect.x, selectionRect.x + selectionRect.width);
    const sy = Math.min(selectionRect.y, selectionRect.y + selectionRect.height);
    const sw = Math.abs(selectionRect.width);
    const sh = Math.abs(selectionRect.height);

    const selected = elements
      .filter(el => isIntersecting(
        { x: sx, y: sy, width: sw, height: sh },
        getSelectionBounds(el, elementsMap),
      ))
      .map(el => el.key);

    if (selected.length > 0) {
      selectMultiple([...new Set([...selectedIds, ...selected])]);
    }
    setSelectionRect(null);
  };

  return { selectionRect, handleWheel, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp };
}
