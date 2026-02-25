"use client";

import {
  DndContext,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import Canvas from "@/components/Canvas";
import {PropertiesPanel} from "@/components/PropertiesPanel";
import Palette from "@/components/Palette";
import { Save, Upload } from "lucide-react"; // ← рекомендую добавить lucide-react

export default function EditorPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const elements = useEditorStore((s) => s.elements);
  const updateElement = useEditorStore((s) => s.updateElement);

  const exportSchema = useEditorStore((s) => s.exportSchema);
  // const importSchema = useEditorStore((s) => s.loadSchema); // предполагаем, что метод есть

  const selectedElementIds = useEditorStore((s) => s.selectedIds);

  const selectedElement = elements.find(el => el.id === selectedElementIds[0])

  const temporal = useEditorStore.temporal;
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const { undo, redo } = temporal.getState();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }

        if (e.key.toLowerCase() === "g") {
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
  }, [undo, redo]);

  // Автосохранение каждые 5 секунд при изменении элементов
  useEffect(() => {
    const timeout = setTimeout(() => {
      exportSchema();
    }, 5000);

    return () => clearTimeout(timeout);
  }, [elements, exportSchema]);

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Верхняя панель */}
      <header className="h-14 bg-neutral-900/80 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
        <div className="text-lg font-semibold tracking-tight">
          Редактор схем
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportSchema}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium
              bg-neutral-800 hover:bg-neutral-700 border border-neutral-700
              transition-colors active:scale-[0.98]
            `}
          >
            <Save size={16} />
            Сохранить
          </button>

          <button
            // onClick={importSchema}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium
              bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/40
              transition-colors active:scale-[0.98] shadow-sm
            `}
          >
            <Upload size={16} />
            Загрузить
          </button>
        </div>

        <div className="flex gap-3 p-2 bg-neutral-900 border-b border-neutral-800">
          <button
            onClick={useEditorStore.getState().groupSelected}
            disabled={selectedIds.length < 2}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium"
          >
            Сгруппировать
          </button>

          <button
            onClick={useEditorStore.getState().ungroupSelected}
            disabled={!selectedIds.some(id => {
              const el = useEditorStore.getState().elements.find(e => e.id === id);
              return el?.type === "group";
            })}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm font-medium"
          >
            Разгруппировать
          </button>
        </div>
      </header>

      {/* Основная область */}
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={(event) => {
          const { over, active, activatorEvent } = event;

          if (over?.id === "canvas") {
            const mouseEvent = activatorEvent as MouseEvent | TouchEvent;
            const rect = useEditorStore.getState().canvasRect;
            if (!rect) return;

            // лучше использовать координаты относительно canvas
            const clientX =
              "clientX" in mouseEvent ? mouseEvent.clientX : 0;
            const clientY =
              "clientY" in mouseEvent ? mouseEvent.clientY : 0;

            const type = active.id;
            useEditorStore.getState().addElementAt(clientX, clientY, type);
          }

          setActiveId(null);
        }}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Левая панель — палитра элементов */}
          <aside className="w-72 border-r border-neutral-800 bg-neutral-900/60 overflow-y-auto">
            <Palette />
          </aside>

          {/* Центральная область — холст */}
          <main className="flex-1 bg-neutral-950 relative">
            <Canvas />
          </main>

          {/* Правая панель — свойства */}
          <aside className="w-80 border-l border-neutral-800 bg-neutral-900/60 overflow-y-auto">
            {selectedElement ? (
              <PropertiesPanel
                element={selectedElement}
                updateElement={updateElement}
              />
            ) : (
              <div className="h-full flex flex-col items-center text-center p-6">
                <div className="text-neutral-500 text-sm font-medium tracking-tight">
                  Выберите элемент
                </div>
                <div className="mt-2 text-neutral-600 text-xs max-w-[220px]">
                  Кликните на любой элемент на холсте, чтобы открыть его свойства
                </div>
              </div>
            )}
          </aside>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg shadow-2xl text-sm font-medium opacity-90 scale-110">
              {activeId}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}