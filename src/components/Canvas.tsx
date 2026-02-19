"use client";

import {useEditorStore} from "@/store/useEditorStore";
import {Rnd} from "react-rnd";
import {useDroppable} from "@dnd-kit/core";
import {useRef} from "react";

const GRID = 20;
const snap = (v: number) => Math.round(v / GRID) * GRID;

export default function Canvas() {
  const {elements, updateElement, select, selectedId} = useEditorStore();

  const {setNodeRef} = useDroppable({
    id: 'canvas'
  });


  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        ref.current = node;
      }}
      className="relative w-[800px] h-[600px] bg-[#1e1e1e] border border-gray-700"
      onMouseDown={() => select(null)}
      style={{
        zIndex: 0,
        backgroundColor: "#ccc",
        backgroundSize: `${GRID}px ${GRID}px`,
        backgroundImage: `
          linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)
        `,
      }}

    >
      {elements.map(el => {
        const isSelected = selectedId === el.id;

        return (
          <Rnd
            key={el.id}
            size={{width: el.w, height: el.h}}
            position={{x: el.x, y: el.y}}
            bounds="parent"
            dragGrid={[GRID, GRID]}
            resizeGrid={[GRID, GRID]}
            onDragStop={(e, d) =>
              updateElement(el.id, {
                x: snap(d.x),
                y: snap(d.y),
              })
            }
            onResizeStop={(e, dir, ref, delta, pos) =>
              updateElement(el.id, {
                w: parseInt(ref.style.width),
                h: parseInt(ref.style.height),
                x: snap(pos.x),
                y: snap(pos.y),
              })
            }
            onMouseDown={e => {
              e.stopPropagation();
              select(el.id);
            }}
          >
            <div
              style={{background: el.bg}}
              className={`w-full h-full flex items-center justify-center 
                ${
                isSelected
                  ? "border-2 border-blue-500 bg-blue-50"
                  : "border border-gray-400 bg-white"
              }`}
            >
              {el.label}
            </div>
          </Rnd>
        )
      })}
    </div>
  )
}