"use client";

import React, {useMemo, useRef, useEffect, useCallback, useState} from "react";
import {useDroppable} from "@dnd-kit/core";
import {useEditorStore} from "@/store/useEditorStore";
import {GRID} from "@/lib/utils";
import {DiagramElement, GroupElement, LeafElement} from "@/types/editorElement.type";
import isIntersecting from "@/lib/isIntersecting";
import {LinesLayer} from "@/components/editor/LinesLayer";
import {DynamicContextMenu} from "@/components/ui/ContextMenuRadixUI";
import {editorElementMenuItems} from "@/constants/contextMenuItems";
import {getDescendants} from "@/lib/getDescendants";
import {OpenCreateFaceplateModal} from "@/components/ui/OpenCreateFaceplateModal";
import {handleAddProperty} from "@/lib/handleAddProperty";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {Stage, Layer, Rect, Circle, Line, Text, Group, Path, RegularPolygon} from "react-konva";
import Konva from "konva";

const MIN_SIZE = 20;

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
    updateElementVisual
  } = useEditorStore();

  const CANVAS_WIDTH = 5000;
  const CANVAS_HEIGHT = 5000;

  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number; } | null>(null);

  // Custom context menu state for the canvas
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: any[] } | null>(null);

  const {setNodeRef} = useDroppable({id: "canvas"});
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

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

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (!e.evt.ctrlKey) {
        // pan via wheel?
        return;
    }
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const zoomSensitivity = 0.001;
    let newZoom = Math.min(Math.max(oldScale + (-e.evt.deltaY * zoomSensitivity), 0.2), 3);

    setCameraZoom(newZoom);
    setCameraPan(
      pointer.x - mousePointTo.x * newZoom - camera.x,
      pointer.y - mousePointTo.y * newZoom - camera.y
    );
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (contextMenu) setContextMenu(null);
    const clickedOnEmpty = e.target === e.target.getStage();
    const clickedOnBg = e.target.name() === "grid-bg";

    // Middle click pan
    if (e.evt instanceof MouseEvent && (e.evt.button === 1 || e.evt.buttons === 4)) {
       return;
    }

    if (clickedOnEmpty || clickedOnBg) {
      if (!e.evt.shiftKey) {
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

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
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
      const selBox = {x: sx, y: sy, w: sw, h: sh};

      const selected = elements
        .filter(el => {
          const re = getRenderedElement(el);
          return isIntersecting(selBox, { x: re.x, y: re.y, w: re.w, h: re.h });
        })
        .map(el => el.key);

      if (selected.length > 0) {
        selectMultiple(selected);
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
      ...editorElementMenuItems.map(item => ({...item, onClick: () => { item.onClick?.(); closeMenu(); }})),
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
         fill="white"
         stroke="#3b82f6"
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
      let pts = rendered.points || [];
      if (typeof pts === "string") {
          try { pts = JSON.parse(pts); } catch(err) { pts = []; }
      }

      const expectedLen = (rendered.sides || 3) * 2;
      if (!Array.isArray(pts) || pts.length !== expectedLen) {
          const sides = rendered.sides || 3;
          const radius = rendered.radius || 40;
          const cx = rendered.x + (rendered.w / 2 || 0);
          const cy = rendered.y + (rendered.h / 2 || 0);
          pts = [];
          for (let i = 0; i < sides; i++) {
              const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
              pts.push(cx + radius * Math.cos(angle));
              pts.push(cy + radius * Math.sin(angle));
          }
      }

      return (
        <Group key={el.key} id={el.key}>
           <Line
             points={pts as number[]}
             closed={true}
             fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
             stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || "#333")}
             strokeWidth={isSelected ? 3 : (rendered.strokeWidth || 2)}
             draggable
             onDragEnd={(e) => {
                 const node = e.target;
                 const dx = node.x();
                 const dy = node.y();
                 const newPts = (pts as number[]).map((p, i) => i % 2 === 0 ? p + dx : p + dy);
                 node.position({x:0,y:0});
                 updateElementVisual(el.key, { points: newPts });
             }}
             onClick={(e) => {
                if(e.evt.shiftKey) { setContextMenu(null); selectMultiple([...selectedIds, el.key]); }
                else { setContextMenu(null); selectMultiple([el.key]); }
             }}
           />
           {isSelected && (pts as number[]).map((p, i) => {
              if (i % 2 !== 0) return null; // skip y
              return renderAnchor(
                 p, (pts as number[])[i+1],
                 (e) => {
                     const cp = [...(pts as number[])];
                     cp[i] = e.target.x();
                     cp[i+1] = e.target.y();
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
       return (
         <Group key={el.key} id={el.key}>
            <Circle
               x={cx}
               y={cy}
               radius={r}
               fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
               stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || "#333")}
               strokeWidth={isSelected ? 3 : (rendered.strokeWidth || 2)}
               draggable
               onDragEnd={(e) => {
                   const nx = e.target.x();
                   const ny = e.target.y();
                   const dx = nx - cx;
                   const dy = ny - cy;
                   e.target.position({x: cx, y: cy});
                   updateElementVisual(el.key, { x: rendered.x + dx, y: rendered.y + dy });
               }}
               onClick={(e) => {
                   if(e.evt.shiftKey) selectMultiple([...selectedIds, el.key]);
                   else selectMultiple([el.key]);
               }}
            />
            {isSelected && renderAnchor(
               cx + r, cy,
               (e) => {
                   const newR = Math.sqrt(Math.pow(e.target.x() - cx, 2) + Math.pow(e.target.y() - cy, 2));
                   const clampedR = Math.max(1, newR);
                   updateElementVisual(el.key, { radius: clampedR, w: clampedR * 2, h: clampedR * 2 });
               },
               `${el.key}-anc-r`
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
              stroke={isSelected ? "#3b82f6" : "#9ca3af"}
              strokeWidth={rendered.strokeWidth || 2}
              draggable
              onDragEnd={(e) => {
                  const dx = e.target.x();
                  const dy = e.target.y();
                  e.target.position({x:0, y:0});
                  updateElementVisual(el.key, {
                      x1: x1 + dx, y1: y1 + dy,
                      x2: x2 + dx, y2: y2 + dy,
                      x: (x1 + x2)/2 + dx, y: (y1 + y2)/2 + dy,
                  });
              }}
              onClick={(e) => {
                   if(e.evt.shiftKey) selectMultiple([...selectedIds, el.key]);
                   else selectMultiple([el.key]);
              }}
            />
            {isSelected && renderAnchor(x1, y1, (e) => updateElementVisual(el.key, { x1: e.target.x(), y1: e.target.y() }), `${el.key}-anc-1`)}
            {isSelected && renderAnchor(x2, y2, (e) => updateElementVisual(el.key, { x2: e.target.x(), y2: e.target.y() }), `${el.key}-anc-2`)}
         </Group>
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
             updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() });
         }}
         onClick={(e) => {
           if(e.evt.shiftKey) selectMultiple([...selectedIds, el.key]);
           else selectMultiple([el.key]);
         }}
      >
        <Rect
          width={rendered.w}
          height={rendered.h}
          fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
          stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || "#333")}
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
             fill={rendered.textColor || "#000"}
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
    const rendered = getRenderedElement(group);

    return (
       <Group
         key={group.key}
         id={group.key}
         x={group.x}
         y={group.y}
         draggable
         onDragEnd={(e) => {
             updateElementVisual(group.key, { x: e.target.x(), y: e.target.y() });
         }}
       >
         {group.children.map(childId => {
             const child = elementsMap[childId];
             if (!child) return null;
             if (child.type === 'group') return renderGroup(child as GroupElement);
             return renderShapeElement(child);
         })}
         <Circle
           x={group.w / 2}
           y={group.h / 2}
           radius={6}
           fill={isSelected ? "#3b82f6" : "rgba(59,130,246,0.4)"}
           stroke={isSelected ? "white" : "rgba(59,130,246,0.8)"}
           strokeWidth={2}
           onClick={(e) => {
             e.cancelBubble = true;
             if(e.evt.shiftKey) selectMultiple([...selectedIds, group.key]);
             else selectMultiple([group.key]);
           }}
           onMouseEnter={e => {
              const container = e.target.getStage()?.container();
              if(container) container.style.cursor = "move";
           }}
           onMouseLeave={e => {
              const container = e.target.getStage()?.container();
              if(container) container.style.cursor = "default";
           }}
         />
       </Group>
    );
  }

  return (
    <div
      ref={containerRef}
      id="canvas-viewport"
      className="relative w-full h-full overflow-hidden bg-neutral-950 context-menu-container"
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
                      ctx.strokeStyle = "rgba(100,100,120,0.4)";
                      ctx.beginPath();
                      ctx.moveTo(0,0); ctx.lineTo(GRID,0);
                      ctx.moveTo(0,0); ctx.lineTo(0,GRID);
                      ctx.stroke();
                  }
                  return cvs;
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
          <div className="min-w-40 bg-neutral-800 rounded-md overflow-hidden p-1 shadow-xl border border-gray-200">
             {contextMenu.items.map((item, idx) => (
               <div
                  key={idx}
                  onClick={item.onClick}
                  className={`
                    group flex items-center px-3 py-2 text-sm outline-none cursor-default rounded-sm text-gray-700 focus:bg-indigo-600 focus:text-gray-900 dark:text-white hover:bg-indigo-600
                  `}
               >
                  {item.label}
               </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}