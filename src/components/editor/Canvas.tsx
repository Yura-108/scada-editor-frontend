"use client";

import React, {useMemo, useRef, useEffect, useState} from "react";
import {useDroppable} from "@dnd-kit/core";
import {useTheme} from "next-themes";
import {useEditorStore} from "@/store/useEditorStore";
import {GRID, snap} from "@/lib/utils";
import {DiagramElement, GroupElement, LeafElement} from "@/types/editorElement.type";
import isIntersecting from "@/lib/isIntersecting";
import {editorElementMenuItems} from "@/constants/contextMenuItems";
import {getDescendants} from "@/lib/getDescendants";
import {OpenCreateFaceplateModal} from "@/components/ui/OpenCreateFaceplateModal";
import {handleAddProperty} from "@/lib/handleAddProperty";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {Stage, Layer, Rect, Circle, Line, Text, Group} from "react-konva";
import Konva from "konva";
import { MoveToGroupModal } from "@/components/ui/MoveToGroupModal";

const MIN_SIZE = 20;

interface CircleResizeHandleProps {
  cx: number;
  cy: number;
  r: number;
  elKey: string;
  snap: (v: number) => number;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
  circleRef: React.RefObject<Konva.Circle | null>;
}

function CircleResizeHandle({ cx, cy, r, elKey, snap, updateElementVisual, circleRef }: CircleResizeHandleProps) {
  const handleRef = useRef<Konva.Circle>(null);

  return (
    <Circle
      ref={handleRef}
      x={cx + r}
      y={cy}
      radius={8}
      fill="transparent"
      stroke="transparent"
      hitStrokeWidth={12}
      draggable
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragMove={(e) => {
        const dx = e.target.x() - cx;
        const dy = e.target.y() - cy;
        const newR = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        // Зажимаем handle на горизонтальной оси
        e.target.y(cy);
        // Обновляем круг императивно — без React ре-рендера
        circleRef.current?.radius(newR);
        circleRef.current?.getLayer()?.batchDraw();
      }}
      onDragEnd={(e) => {
        const dx = e.target.x() - cx;
        const dy = e.target.y() - cy;
        const newR = Math.max(1, snap(Math.sqrt(dx * dx + dy * dy)));
        // Сначала обновляем Konva-узлы до снаппленного значения — убираем визуальный прыжок
        e.target.position({ x: cx + newR, y: cy });
        circleRef.current?.radius(newR);
        circleRef.current?.getLayer()?.batchDraw();
        updateElementVisual(elKey, { radius: newR, w: newR * 2, h: newR * 2 });
      }}
      onMouseEnter={e => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "ew-resize";
      }}
      onMouseLeave={e => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "default";
      }}
    />
  );
}

interface ShapeElementProps {
  el: DiagramElement;
  isSelected: boolean;
  snap: (v: number) => number;
  onElementClick: (key: string, multi: boolean) => void;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
}

function TextShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const textRef = useRef<Konva.Text>(null);
  const { resolvedTheme } = useTheme();
  const textDefaultColor = resolvedTheme === "dark" ? "#ffffff" : "#1a1a1a";

  const pad = 4;

  const fontSize = rendered.fontSize ?? 16;
  const text = rendered.text ?? "Text";
  const fontFamily = rendered.fontFamily || "Arial";
  const fontStyle = rendered.bold ? "bold" : "normal";

  // Измеряем реальный размер текста. Инициализируем через временный узел,
  // затем обновляем по реальному узлу после каждого рендера Konva.
  const [selDims, setSelDims] = useState<{ w: number; h: number }>(() => {
    const tmp = new Konva.Text({ text, fontSize, fontFamily, fontStyle, width: rendered.w || undefined });
    const dims = { w: tmp.getTextWidth(), h: tmp.height() };
    tmp.destroy();
    return dims;
  });

  useEffect(() => {
    if (textRef.current) {
      setSelDims({
        w: textRef.current.getTextWidth(),
        h: textRef.current.height(),
      });
    }
  }, [text, fontSize, fontFamily, fontStyle, rendered.w]);

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => {
        updateElementVisual(el.key, {
          x: snap(e.target.x()),
          y: snap(e.target.y()),
        });
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
      }}
    >
      {isSelected && (
        <Rect
          x={-pad}
          y={-pad}
          width={selDims.w + pad * 2}
          height={selDims.h + pad * 2}
          fill="transparent"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dash={[4, 3]}
          listening={false}
        />
      )}
      <Text
        ref={textRef}
        x={0}
        y={0}
        text={text}
        fontSize={fontSize}
        fontStyle={fontStyle}
        fontFamily={fontFamily}
        fill={rendered.color || rendered.textColor || textDefaultColor}
        align={rendered.align || "left"}
        width={rendered.w || undefined}
        listening={true}
      />
    </Group>
  );
}

function CheckboxShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const BOX = 18;
  const pad = 4;
  const w = rendered.w || 160;
  const h = Math.max(rendered.h || 24, BOX);
  const boxY = (h - BOX) / 2;
  const checked = !!rendered.checked;
  const label = rendered.label ?? "Checkbox";
  const accent = rendered.color || rendered.strokeColor || "#3b82f6";
  const textCol = rendered.textColor || (isDark ? "#ffffff" : "#1a1a1a");
  const fontSize = rendered.fontSize || 14;
  const boxBg = isDark ? "#0a0a0a" : "#ffffff";

  // Галочка: три точки образуют ✓
  const ckPts = [
    BOX * 0.15, BOX * 0.50,
    BOX * 0.42, BOX * 0.76,
    BOX * 0.85, BOX * 0.20,
  ];

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => updateElementVisual(el.key, { x: snap(e.target.x()), y: snap(e.target.y()) })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <Rect
          x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2}
          fill="transparent" stroke="#3b82f6" strokeWidth={1.5} dash={[4, 3]} listening={false}
        />
      )}
      {/* Квадрат чекбокса */}
      <Rect
        x={0} y={boxY} width={BOX} height={BOX}
        fill={checked ? accent : boxBg}
        stroke={accent} strokeWidth={1.5} cornerRadius={3}
      />
      {/* Галочка */}
      {checked && (
        <Line
          x={0} y={boxY}
          points={ckPts}
          stroke="#ffffff" strokeWidth={2.5}
          lineCap="round" lineJoin="round" listening={false}
        />
      )}
      {/* Подпись */}
      {label && (
        <Text
          x={BOX + 8} y={0}
          text={label} fontSize={fontSize}
          fill={textCol} width={w - BOX - 8} height={h}
          verticalAlign="middle"
        />
      )}
    </Group>
  );
}

function ProgressBarShapeElement({ el, isSelected, snap, onElementClick, updateElementVisual }: ShapeElementProps) {
  const rendered = getRenderedElement(el) as LeafElement;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const pad = 4;
  const w = rendered.w || 200;
  const h = rendered.h || 20;
  const value = Math.max(0, Math.min(100, Number(rendered.value) || 0));
  const isVertical = rendered.orientation === "vertical";

  // For vertical: fill grows along height; for horizontal: along width
  const trackLength = isVertical ? h : w;
  const fillLength = (trackLength * value) / 100;
  const thickness = isVertical ? w : h;

  const trackColor = rendered.bg || (isDark ? "#3f3f46" : "#e5e7eb");
  const fillColor = rendered.color || "#3b82f6";
  const textCol = rendered.textColor || "#ffffff";
  const showPct = rendered.showPercentage !== false;
  const r = Math.min(4, Math.min(trackLength, thickness) / 2);
  const fillFull = fillLength >= trackLength - 0.5;

  // Position of the fill rect
  const fillX = isVertical ? 0 : 0;
  const fillY = isVertical ? (trackLength - fillLength) : 0;
  const fillW = isVertical ? thickness : fillLength;
  const fillH = isVertical ? fillLength : thickness;

  // Corner radii: rounded only on the leading edge of the fill
  const fillRadius = fillFull
    ? r
    : isVertical
      ? [0, 0, r, r]
      : [r, 0, 0, r];

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => updateElementVisual(el.key, { x: snap(e.target.x()), y: snap(e.target.y()) })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <Rect
          x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2}
          fill="transparent" stroke="#3b82f6" strokeWidth={1.5} dash={[4, 3]} listening={false}
        />
      )}
      {/* Трек (фон) */}
      <Rect x={0} y={0} width={w} height={h} fill={trackColor} cornerRadius={r} />
      {/* Заполнение */}
      {fillLength > 0 && (
        <Rect
          x={fillX} y={fillY} width={fillW} height={fillH}
          fill={fillColor}
          cornerRadius={fillRadius}
        />
      )}
      {/* Процент */}
      {showPct && (
        isVertical ? (
          // Vertical: rotate text 90deg around the track center
          thickness >= 12 && (
            <Text
              x={-h / 2} y={thickness / 2 - (Math.max(10, Math.floor(thickness * 0.62)))}
              width={h} height={thickness}
              rotation={-90}
              text={`${Math.round(value)}%`}
              fontSize={Math.max(10, Math.floor(thickness * 0.62))}
              fill={textCol} align="center" verticalAlign="middle"
              listening={false}
            />
          )
        ) : (
          h >= 12 && (
            <Text
              x={0} y={0} width={w} height={h}
              text={`${Math.round(value)}%`}
              fontSize={Math.max(10, Math.floor(h * 0.62))}
              fill={textCol} align="center" verticalAlign="middle"
              listening={false}
            />
          )
        )
      )}
    </Group>
  );
}


export default function Canvas() {
  const {
    elements,
    selectedIds,
    selectMultiple,
    setCanvasRect,
    deleteSelectedElement,
    copySelectedElement,
    pasteSelectedElement,
    camera,
    scene,
    setCameraPan,
    setCameraZoom,
    updateElementVisual,
    activeGroupKey,
    enterGroup,
    exitGroup,
    clearSelection,
  } = useEditorStore();

  console.log(elements)

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const themeColors = {
    textDefault:     isDark ? "#ffffff" : "#1a1a1a",
    labelDefault:    isDark ? "#ffffff" : "#000000",
    strokeDefault:   isDark ? "#9ca3af" : "#6b7280",
    canvasBg:        isDark ? "#0a0a0a" : "#ffffff",
    gridLine:        isDark ? "rgba(100,100,120,0.4)" : "rgba(0,0,0,0.07)",
    anchorFill:      isDark ? "#ffffff" : "#1a1a1a",
    anchorStroke:    "#3b82f6",
  };

  const CANVAS_WIDTH = 5000;
  const CANVAS_HEIGHT = 5000;

  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number; } | null>(null);

  // Custom context menu state for the canvas
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: any[] } | null>(null);

  // Modal state for moving to group
  const [moveToGroupState, setMoveToGroupState] = useState<{ isOpen: boolean, elementKey: string | null }>({
    isOpen: false,
    elementKey: null
  });

  const {setNodeRef} = useDroppable({id: "canvas"});
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const middlePanRef = useRef<{ x: number; y: number } | null>(null);

  console.log(elements)

  // Middle mouse button pan — native window events so drag works outside canvas bounds
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
  }, []);

  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        setCanvasRect(containerRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [setCanvasRect]);

  const rootElements = useMemo(() => elements.filter(el => el.parentKey === String(scene?.id)), [elements, scene]);
  const elementsMap = useMemo(() => {
    const map: Record<string, DiagramElement> = {};
    elements.forEach(el => map[el.key] = el);
    return map;
  }, [elements]);

  // Given a clicked element key, resolve what should actually be selected.
  // In top-level mode: returns the root ancestor (child of the scene).
  // In group-entered mode: returns the direct child of activeGroupKey,
  //   or null if the clicked element is outside the active group.
  const resolveClickTarget = (clickedKey: string): string | null => {
    const sceneId = String(scene?.id);

    if (!activeGroupKey) {
      // Walk up to find the root (direct child of scene)
      let key: string | null = clickedKey;
      let prev = key;
      while (key) {
        const el = elementsMap[key];
        if (!el) break;
        if (el.parentKey === sceneId) return key;
        prev = key;
        key = el.parentKey;
      }
      return prev;
    }

    // Inside a group: find the direct child of activeGroupKey in the path
    let key: string | null = clickedKey;
    while (key) {
      const el = elementsMap[key];
      if (!el) return null;
      if (el.parentKey === activeGroupKey) return key;
      key = el.parentKey;
    }
    return null; // outside the active group
  };

  const handleElementClick = (clickedKey: string, multi: boolean) => {
    const target = resolveClickTarget(clickedKey);
    if (target === null) {
      exitGroup();
      return;
    }
    if (multi) {
      selectMultiple([...selectedIds.filter(id => id !== target), target]);
    } else {
      selectMultiple([target]);
    }
  };

  // Absolute world position of an element, using rendered (override-aware) coords at every level.
  const getAbsoluteRenderedPos = (el: DiagramElement): {x: number; y: number} => {
    const rendered = getRenderedElement(el);
    const parent = el.parentKey ? elementsMap[el.parentKey] : null;
    if (!parent) return { x: rendered.x ?? 0, y: rendered.y ?? 0 };
    const parentPos = getAbsoluteRenderedPos(parent);
    return { x: parentPos.x + (rendered.x ?? 0), y: parentPos.y + (rendered.y ?? 0) };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (activeGroupKey) exitGroup();
        else clearSelection();
      }
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
  }, [deleteSelectedElement, copySelectedElement, pasteSelectedElement, activeGroupKey, exitGroup, clearSelection]);

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
        pointer.y - mousePointTo.y * newZoom - camera.y
      );
    } else if (e.evt.shiftKey) {
      // Shift + Wheel → horizontal pan
      setCameraPan(-e.evt.deltaY, 0);
    } else {
      // Wheel → pan (deltaX + deltaY covers both mouse wheel and trackpad)
      setCameraPan(-e.evt.deltaX, -e.evt.deltaY);
    }
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (contextMenu) setContextMenu(null);
    const clickedOnEmpty = e.target === e.target.getStage();
    const clickedOnBg = e.target.name() === "grid-bg";

    // Middle click → start panning
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
            height: 0
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
            setSelectionRect(prev => prev ? {
               x: prev.x,
               y: prev.y,
               width: rx - prev.x,
               height: ry - prev.y
            } : null);
        }
    }
  };

  const handleStageMouseUp = () => {
    if (selectionRect) {
      const sx = Math.min(selectionRect.x, selectionRect.x + selectionRect.width);
      const sy = Math.min(selectionRect.y, selectionRect.y + selectionRect.height);
      const sw = Math.abs(selectionRect.width);
      const sh = Math.abs(selectionRect.height);

      const getSelectionBounds = (el: DiagramElement) => {
        const rendered = getRenderedElement(el);
        const absPos  = getAbsoluteRenderedPos(el);

        if (rendered.type === "polygon") {
          // Вершины хранятся локально внутри polygon Group.
          // Абсолютная позиция вершины = absPos (позиция Group) + local vertex.
          const pts: number[] = Array.isArray(rendered.points)
            ? rendered.points as number[]
            : (() => { try { return JSON.parse((rendered.points as string | undefined) ?? "[]"); } catch { return []; } })();

          if (pts.length >= 2) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (let i = 0; i + 1 < pts.length; i += 2) {
              minX = Math.min(minX, absPos.x + pts[i]);
              minY = Math.min(minY, absPos.y + pts[i + 1]);
              maxX = Math.max(maxX, absPos.x + pts[i]);
              maxY = Math.max(maxY, absPos.y + pts[i + 1]);
            }
            return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };
          }
        }

        if (rendered.type === "line") {
          // x1/y1/x2/y2 хранятся в той же системе координат что rendered.x/y (родитель-локальная).
          // absPos = parentAbs + rendered.x  →  parentAbs = absPos - rendered.x
          const pax = absPos.x - (rendered.x ?? 0);
          const pay = absPos.y - (rendered.y ?? 0);
          const ax1 = pax + (rendered.x1 ?? rendered.x ?? 0);
          const ay1 = pay + (rendered.y1 ?? rendered.y ?? 0);
          const ax2 = pax + (rendered.x2 ?? ((rendered.x ?? 0) + 80));
          const ay2 = pay + (rendered.y2 ?? rendered.y ?? 0);
          return {
            x: Math.min(ax1, ax2),
            y: Math.min(ay1, ay2),
            w: Math.max(Math.abs(ax2 - ax1), 2),
            h: Math.max(Math.abs(ay2 - ay1), 2),
          };
        }

        return { x: absPos.x, y: absPos.y, w: rendered.w ?? 0, h: rendered.h ?? 0 };
      };

      const selected = elements
        .filter(el => isIntersecting(
          { x: sx, y: sy, width: sw, height: sh },
          getSelectionBounds(el),
        ))
        .map(el => el.key);

      if (selected.length > 0) {
        selectMultiple([...new Set([...selectedIds, ...selected])]);
      }
      setSelectionRect(null);
    }
  };

  const closeMenu = () => setContextMenu(null);

  const buildItemMenu = (el: DiagramElement) => {
    const handleFaceplate = () => {
      const allDescendants = getDescendants(el.key, elements);
      OpenCreateFaceplateModal([el, ...allDescendants]);
      closeMenu();
    };

    return [
      {label: "Добавить свойство", onClick: () => { handleAddProperty(el.id); closeMenu(); }, disabled: !el.id},
      ...editorElementMenuItems.map(item => ({
        ...item,
        onClick: () => {
          if (item.label === 'Переместить в группу') {
            setMoveToGroupState({ isOpen: true, elementKey: el.key });
          } else {
            item.onClick?.();
          }
          closeMenu();
        }
      })),
      el.type === "group" ? {label: "Сохранить в палитру", onClick: handleFaceplate} : null
    ].filter(Boolean);
  };

  const handleStageContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;

    // Check what we clicked
    const tg = e.target;
    if (tg === e.target.getStage() || tg.name() === "grid-bg") {
       setContextMenu({
           x: e.evt.clientX,
           y: e.evt.clientY,
           items: [
               { label: "Вставить", onClick: () => { pasteSelectedElement(); closeMenu(); } },
           ]
       });
       return;
    }

    // Find associated element
    const elId = tg.attrs.id || tg.parent?.attrs.id || tg.parent?.parent?.attrs.id;
    if (elId) {
       selectMultiple([elId]);
       const el = elementsMap[elId];
       if (el) {
           setContextMenu({
               x: e.evt.clientX,
               y: e.evt.clientY,
               items: buildItemMenu(el)
           });
       }
    }
  };
  

  const renderAnchor = (x: number, y: number, onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void, key: string) => {
    return (
      <Circle
        key={key}
         x={x}
         y={y}
         radius={5}
         fill={themeColors.anchorFill}
         stroke={themeColors.anchorStroke}
         strokeWidth={2}
         draggable
         onDragMove={onDragMove}
         onDragStart={(e) => { e.cancelBubble = true; }}
         hitStrokeWidth={10}
         onMouseEnter={e => {
            const container = e.target.getStage()?.container();
            if(container) container.style.cursor = "pointer";
         }}
         onMouseLeave={e => {
            const container = e.target.getStage()?.container();
            if(container) container.style.cursor = "default";
         }}
      />
    );
  };

  const renderShapeElement = (el: DiagramElement) => {
    const isSelected = selectedIds.includes(el.key);
    const rendered = getRenderedElement(el) as LeafElement;

    if (rendered.type === "polygon") {
      let pts: number[] = [];
      const pointsData = rendered.points as string | number[] | undefined;

      if (typeof pointsData === "string") {
          try { pts = JSON.parse(pointsData); } catch(err) { pts = []; }
      } else if (Array.isArray(pointsData)) {
          pts = pointsData;
      }

      const expectedLen = (rendered.sides || 3) * 2;
      if (pts.length !== expectedLen) {
          const sides = rendered.sides || 3;
          const radius = rendered.radius || 40;

          const cx = rendered.w / 2;
          const cy = rendered.h / 2;

          pts = [];
          for (let i = 0; i < sides; i++) {
              const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
              pts.push(cx + radius * Math.cos(angle));
              pts.push(cy + radius * Math.sin(angle));
          }
      }

      return (
          <Group
            key={el.key}
            id={el.key}
            x={rendered.x}
            y={rendered.y}
          >
           <Line
             points={pts as number[]}
             closed={true}
             fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
             stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || themeColors.strokeDefault)}
             strokeWidth={isSelected ? 3 : (rendered.strokeWidth || 2)}
             draggable
              onDragEnd={(e) => {
                  const node = e.target;
                  const dx = node.x();
                  const dy = node.y();
                  node.position({x:0,y:0});
                  updateElementVisual(el.key, {
                    x: snap(rendered.x + dx),
                    y: snap(rendered.y + dy),
                  });
              }}
             onClick={(e) => {
                e.cancelBubble = true;
                setContextMenu(null);
                handleElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
             }}
           />
           {isSelected && (pts as number[]).map((p, i) => {
              if (i % 2 !== 0) return null; // skip y
              return renderAnchor(
                 p, (pts as number[])[i+1],
                 (e) => {
                     const cp = [...(pts as number[])];
                     cp[i] = snap(e.target.x());
                     cp[i+1] = snap(e.target.y());
                     e.target.position({ x: cp[i], y: cp[i+1] });
                     updateElementVisual(el.key, { points: cp });
                 },
                 `${el.key}-anc-${i}`
              );
           })}
        </Group>
      );
    }

    if (rendered.type === "circle") {
       const r = rendered.radius || rendered.w / 2 || 40;
       const cx = rendered.x + r;
       const cy = rendered.y + r;
       const circleRef = React.createRef<Konva.Circle>();
       return (
         <Group key={el.key} id={el.key}>
            <Circle
               ref={circleRef}
               x={cx}
               y={cy}
               radius={r}
               fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
               stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || themeColors.strokeDefault)}
               strokeWidth={isSelected ? 3 : (rendered.strokeWidth || 2)}
               draggable
               onDragEnd={(e) => {
                   const nx = e.target.x();
                   const ny = e.target.y();
                   const dx = nx - cx;
                   const dy = ny - cy;
                   e.target.position({x: cx, y: cy});
                   updateElementVisual(el.key, { x: snap(rendered.x + dx), y: snap(rendered.y + dy) });
               }}
               onClick={(e) => {
                   e.cancelBubble = true;
                   handleElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
               }}
            />
            {isSelected && (
              <CircleResizeHandle
                key={`${el.key}-resize`}
                cx={cx}
                cy={cy}
                r={r}
                elKey={el.key}
                snap={snap}
                updateElementVisual={updateElementVisual}
                circleRef={circleRef}
              />
            )}
         </Group>
       );
    }

    if (rendered.type === "line") {
       const x1 = rendered.x1 ?? rendered.x;
       const y1 = rendered.y1 ?? rendered.y;
       const x2 = rendered.x2 ?? rendered.x + 80;
       const y2 = rendered.y2 ?? rendered.y;
       return (
         <Group key={el.key} id={el.key}>
            <Line
              points={[x1, y1, x2, y2]}
              stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || themeColors.strokeDefault)}
              strokeWidth={rendered.strokeWidth || 2}
              hitStrokeWidth={Math.max(12, rendered.strokeWidth || 2)}
              draggable
              onDragEnd={(e) => {
                  const dx = e.target.x();
                  const dy = e.target.y();
                  e.target.position({x:0, y:0});
                  updateElementVisual(el.key, {
                      x1: snap(x1 + dx), y1: snap(y1 + dy),
                      x2: snap(x2 + dx), y2: snap(y2 + dy),
                      x: snap((x1 + x2)/2 + dx), y: snap((y1 + y2)/2 + dy),
                  });
              }}
              onClick={(e) => {
                   e.cancelBubble = true;
                   handleElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
              }}
            />
            {isSelected && renderAnchor(x1, y1, (e) => {
                const sx = snap(e.target.x());
                const sy = snap(e.target.y());
                e.target.position({ x: sx, y: sy });
                updateElementVisual(el.key, { x1: sx, y1: sy });
            }, `${el.key}-anc-1`)}
            {isSelected && renderAnchor(x2, y2, (e) => {
                const sx = snap(e.target.x());
                const sy = snap(e.target.y());
                e.target.position({ x: sx, y: sy });
                updateElementVisual(el.key, { x2: sx, y2: sy });
            }, `${el.key}-anc-2`)}
         </Group>
       );
    }

    if (rendered.type === "text") {
      return (
        <TextShapeElement
          key={el.key}
          el={el}
          isSelected={isSelected}
          snap={snap}
          onElementClick={handleElementClick}
          updateElementVisual={updateElementVisual}
        />
      );
    }

    if (rendered.type === "checkbox") {
      return (
        <CheckboxShapeElement
          key={el.key}
          el={el}
          isSelected={isSelected}
          snap={snap}
          onElementClick={handleElementClick}
          updateElementVisual={updateElementVisual}
        />
      );
    }

    if (rendered.type === "progress_bar") {
      return (
        <ProgressBarShapeElement
          key={el.key}
          el={el}
          isSelected={isSelected}
          snap={snap}
          onElementClick={handleElementClick}
          updateElementVisual={updateElementVisual}
        />
      );
    }

    return (
      <Group
         key={el.key}
         id={el.key}
         x={rendered.x}
         y={rendered.y}
         rotation={rendered.rotate || 0}
         draggable
         onDragEnd={(e) => {
           updateElementVisual(el.key, {
             x: snap(e.target.x()),
             y: snap(e.target.y()),
           });
         }}
         onClick={(e) => {
           e.cancelBubble = true;
           handleElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
         }}
      >
        <Rect
          width={rendered.w}
          height={rendered.h}
          fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
          stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || themeColors.strokeDefault)}
          strokeWidth={isSelected ? 2 : (rendered.strokeWidth || 1)}
          cornerRadius={rendered.rx || 0}
        />
        {rendered.label && (
           <Text
             text={rendered.label}
             width={rendered.w}
             height={rendered.h}
             align="center"
             verticalAlign="middle"
             fill={rendered.textColor || themeColors.labelDefault}
           />
        )}

        {isSelected && renderAnchor(rendered.w, rendered.h, (e) => {
            updateElementVisual(el.key, { w: Math.max(MIN_SIZE, e.target.x()), h: Math.max(MIN_SIZE, e.target.y()) });
        }, `${el.key}-anc-se`)}
      </Group>
    );
  };

  const renderGroup = (group: GroupElement) => {
    const isSelected = selectedIds.includes(group.key);
    const isActive = activeGroupKey === group.key;
    const rendered = getRenderedElement(group);

    return (
       <Group
         key={group.key}
         id={group.key}
         x={rendered.x}
         y={rendered.y}
         draggable
         onDragStart={(e) => {
             if (e.target === e.currentTarget && !isSelected) {
               e.target.stopDrag();
             }
         }}
         onDragEnd={(e) => {
             if (e.target !== e.currentTarget) return;
             updateElementVisual(group.key, {
               x: snap(e.target.x()),
               y: snap(e.target.y())
             });
         }}
         onDblClick={(e) => {
           e.cancelBubble = true;
           const clickedId = (e.target as Konva.Node).attrs.id
             || (e.target as Konva.Node).parent?.attrs.id
             || (e.target as Konva.Node).parent?.parent?.attrs.id;
           const resolved = clickedId ? resolveClickTarget(clickedId) : group.key;
           if (resolved === group.key) {
             enterGroup(group.key);
           }
         }}
       >
         {/* Background rect: hit area + selection/active border */}
         <Rect
           x={0}
           y={0}
           width={rendered.w}
           height={rendered.h}
           fill="transparent"
           stroke={isActive ? "#f59e0b" : isSelected ? "#3b82f6" : "transparent"}
           strokeWidth={isActive || isSelected ? 2 : 0}
           dash={isActive ? [6, 3] : [4, 3]}
           listening={true}
           onClick={(e) => {
             e.cancelBubble = true;
             handleElementClick(group.key, e.evt.shiftKey || e.evt.ctrlKey);
           }}
           onMouseEnter={e => {
             if (isSelected) {
               const container = e.target.getStage()?.container();
               if (container) container.style.cursor = "move";
             }
           }}
           onMouseLeave={e => {
             const container = e.target.getStage()?.container();
             if (container) container.style.cursor = "default";
           }}
         />
         {group.children.map(childId => {
             const child = elementsMap[childId];
             if (!child) return null;
             if (child.type === 'group') return renderGroup(child as GroupElement);
             return renderShapeElement(child);
         })}
       </Group>
    );
  }

  return (
    <div
      ref={containerRef}
      id="canvas-viewport"
      className="relative w-full h-full overflow-hidden bg-white dark:bg-neutral-950 context-menu-container"
    >
      <div
        ref={setNodeRef}
        style={{width:"100%", height:"100%"}}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Stage
          ref={stageRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          scaleX={camera.zoom}
          scaleY={camera.zoom}
          x={camera.x}
          y={camera.y}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onContextMenu={handleStageContextMenu}
        >
          <Layer>
            <Rect
               key={`canvas-bg-${resolvedTheme}`}
               name="canvas-bg"
               x={-CANVAS_WIDTH/2}
               y={-CANVAS_HEIGHT/2}
               width={CANVAS_WIDTH*2}
               height={CANVAS_HEIGHT*2}
               fill={themeColors.canvasBg}
               listening={false}
            />
            <Rect
               key={`grid-${resolvedTheme}`}
               name="grid-bg"
               x={-CANVAS_WIDTH/2}
               y={-CANVAS_HEIGHT/2}
               width={CANVAS_WIDTH*2}
               height={CANVAS_HEIGHT*2}
               fillPriority="pattern"
               fillPatternImage={(()=>{
                  const cvs = document.createElement("canvas");
                  cvs.width = GRID; cvs.height = GRID;
                  const ctx = cvs.getContext("2d");
                  if (ctx) {
                      ctx.strokeStyle = themeColors.gridLine;
                      ctx.beginPath();
                      ctx.moveTo(0,0); ctx.lineTo(GRID,0);
                      ctx.moveTo(0,0); ctx.lineTo(0,GRID);
                      ctx.stroke();
                  }
                  return cvs as any;
               })()}
            />

            {rootElements.map(el => (
              <React.Fragment key={el.key}>
                {el.type === 'group' ? renderGroup(el as GroupElement) : renderShapeElement(el)}
              </React.Fragment>
            ))}

            {selectionRect && (
              <Rect
                x={Math.min(selectionRect.x, selectionRect.x + selectionRect.width)}
                y={Math.min(selectionRect.y, selectionRect.y + selectionRect.height)}
                width={Math.abs(selectionRect.width)}
                height={Math.abs(selectionRect.height)}
                fill="rgba(0, 150, 255, 0.2)"
                stroke="#0096ff"
                strokeWidth={1}
              />
            )}
          </Layer>
        </Stage>
      </div>

      {contextMenu && (
        <div style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}>
          <div className="min-w-40 bg-white dark:bg-neutral-800 rounded-md overflow-hidden p-1 shadow-xl border border-gray-200 dark:border-neutral-700">
             {contextMenu.items.map((item, idx) => (
               <div
                  key={idx}
                  onClick={item.onClick}
                  className={`
                    group flex items-center px-3 py-2 text-sm outline-none cursor-default rounded-sm text-gray-700 dark:text-white hover:bg-indigo-500 hover:text-white
                  `}
               >
                  {item.label}
               </div>
             ))}
          </div>
        </div>
      )}

      <MoveToGroupModal
        isOpen={moveToGroupState.isOpen}
        elementKey={moveToGroupState.elementKey}
        onClose={() => setMoveToGroupState({ isOpen: false, elementKey: null })}
      />
    </div>
  );
}