"use client";

import {useEffect} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import WorkSpace from "@/components/editor/WorkSpace";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useAutoSaveScene} from "@/lib/useAutoSaveScene";

export default function EditorPage() {
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
      {/* Элементы добавляются кликом: клик по элементу палитры «вооружает» инструмент,
          клик по холсту ставит элемент (см. Canvas.handleStagePlacementClick). */}
      <WorkSpace />
    </div>
  );
}
