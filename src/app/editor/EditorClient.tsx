"use client";

import {
  DndContext,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {useEffect, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {ElementType} from "@/types/editorElement.type";
import WorkSpace from "@/components/editor/WorkSpace";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useAutoSaveScene} from "@/lib/useAutoSaveScene";

export default function EditorPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const {loadPaletteItems} = usePaletteStore();

  // Автосохранение сцены раз в минуту (только при изменениях, тихо, без сброса выделения).
  useAutoSaveScene();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey) {
        const { undo, redo } = useEditorStore.temporal.getState();
        if (e.code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        if (e.code === 'KeyY') {
          e.preventDefault();
          redo();
        }

        if (e.code === 'KeyG') {
          e.preventDefault();
          if (e.shiftKey) {
            useEditorStore.getState().ungroupSelected();
          } else {
            useEditorStore.getState().groupSelected();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // Automatically load palette items on mount if they haven't been loaded
    loadPaletteItems();
  }, [loadPaletteItems]);

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-100 overflow-hidden">
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={(event) => {
          const { over, active } = event;
          if (!over) return;

          if (over?.id === "canvas") {
            const { camera, canvasRect } = useEditorStore.getState();
            const translatedRect = active.rect.current.translated;

            if (translatedRect && canvasRect) {
              const localX = translatedRect.left - canvasRect.left;
              const localY = translatedRect.top - canvasRect.top;

              const worldX = (localX - camera.x) / camera.zoom;
              const worldY = (localY - camera.y) / camera.zoom;

              if (worldX < 0 || worldY < 0 || worldX > 5000 || worldY > 5000) return;

              const type = active.data.current?.type as ElementType;
              const templateData = active.data.current?.template;

              if (type === 'custom') {
                useEditorStore.getState().addTemplate(worldX, worldY, templateData);
              } else {
                useEditorStore.getState().addElementAt(worldX, worldY, type);
              }
            }
          }
          setActiveId(null);
        }}
      >
        <WorkSpace />

        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div
              className="bg-linear-to-r from-blue-600 to-indigo-600 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg shadow-2xl text-sm font-medium opacity-90 scale-110">
              {activeId}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
