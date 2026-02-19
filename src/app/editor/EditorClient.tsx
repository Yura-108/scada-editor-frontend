"use client";

import {
  DndContext,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import { useState } from "react";
import {useEditorStore} from "@/store/useEditorStore";
import Canvas from "@/components/Canvas";
import PropertiesPanel from "@/components/PropertiesPanel";
import Palette from "@/components/Palette";

export default function EditorPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const addElementAt = useEditorStore((s) => s.addElementAt);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={(event) => {
        setActiveId(event.active.id as string);
      }}
      onDragEnd={(event) => {
        const { over, activatorEvent } = event;

        if (over?.id === "canvas") {
          const e = activatorEvent as MouseEvent;
          addElementAt(e.clientX, e.clientY);
        }

        setActiveId(null);
      }}
    >
      <div className="flex gap-4 p-4">
        <Palette />
        <Canvas />
        <PropertiesPanel />
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-blue-500 text-white px-3 py-2 rounded shadow-lg">
            {activeId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
