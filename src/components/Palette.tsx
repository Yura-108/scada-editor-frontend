"use client";

import {useDraggable} from "@dnd-kit/core";

function DraggableItem({id, label}: {id: string; label: string}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform
  } = useDraggable({id});

  const style = transform
    ? {
      transform: `translate(${transform.x}px, ${transform.y}px)`
    }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 mb-2 bg-gray-600 border rounded cursor-grab"
    >
      {label}
    </div>
  );
}

export default function Palette() {
  return (
    <div className="w-48 p-2 bg-gray-200">
      <DraggableItem id={"new-element"} label={"Element"} />
    </div>
  )
}