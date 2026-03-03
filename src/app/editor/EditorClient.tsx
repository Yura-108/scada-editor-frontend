"use client";

import {
  DndContext,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {useEffect, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import Canvas from "@/components/Canvas";
import {PropertiesPanel} from "@/components/PropertiesPanel";
import Palette from "@/components/Palette";
import {Save, Upload} from "lucide-react";
import {ElementType} from "@/types/editorElement.type";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";

export default function EditorPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const {
    elements,
    scene,
    exportSchema,
    loadSchema,
    selectedIds,
    createScene,
    updateElement,
    loadSceneList
  } = useEditorStore();

  const selectedElement = elements.find(el => el.id === selectedIds[0]);

  const temporal = useEditorStore.temporal;

  const {undo, redo} = temporal.getState();

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

  const handleLoadSchema = async () => {
    loadSceneList();
    openChooseSceneModal();
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      {!scene && (
        <>
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#6366f1_0%,transparent_40%)] animate-pulse-slow"></div>
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,#a855f7_0%,transparent_45%)] animate-pulse-slow delay-1000"></div>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-16 px-6 text-center p-10">

            <div className="mb-4">
              <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight">
               <span
                 className="bg-clip-text text-transparent bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
                 Редактор схем
                </span>
              </h1>
              <p className="mt-4 text-xl md:text-2xl text-gray-300 font-light">
                Начните создавать прямо сейчас
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-8 md:gap-12">

              <button
                onClick={createScene}
                className="group relative px-12 py-8 rounded-2xl text-2xl md:text-3xl font-bold overflow-hidden transition-all duration-500 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-500/40">
                <span
                  className="absolute inset-0 bg-linear-to-r from-indigo-600 to-purple-600 group-hover:from-indigo-500 group-hover:to-purple-500 transition-all duration-500"></span>
                <span
                  className="absolute inset-0 rounded-2xl border-2 border-indigo-400/50 group-hover:border-indigo-300 group-hover:shadow-[0_0_30px_rgba(129,140,248,0.7)] transition-all duration-500"></span>
                <span
                  className="absolute inset-0 bg-linear-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-700"></span>
                <span
                  className="relative text-white drop-shadow-lg group-hover:drop-shadow-2xl transition-all duration-500">
                    Создать новую схему
                </span>
              </button>

              <button
                onClick={handleLoadSchema}
                className="group relative px-12 py-8 rounded-2xl text-2xl md:text-3xl font-bold overflow-hidden transition-all duration-500 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/40">
                <span
                  className="absolute inset-0 bg-linear-to-r from-purple-600 to-pink-600 group-hover:from-purple-500 group-hover:to-pink-500 transition-all duration-500"></span>

                <span
                  className="absolute inset-0 rounded-2xl border-2 border-purple-400/50 group-hover:border-purple-300 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.7)] transition-all duration-500"></span>

                <span
                  className="absolute inset-0 bg-linear-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-700"></span>

                <span
                  className="relative text-white drop-shadow-lg group-hover:drop-shadow-2xl transition-all duration-500">
                    Загрузить схему
                </span>
              </button>

            </div>

          </div>
        </>
      )}

      {scene && (
        <>
          <header
            className="h-14 bg-neutral-900/80 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
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
                <Save size={16}/>
                Сохранить
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

          <DndContext
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(e.active.id as string)}
            onDragEnd={(event) => {
              const {over, active, activatorEvent} = event;

              if (over?.id === "canvas") {
                const mouseEvent = activatorEvent as MouseEvent | TouchEvent;
                const rect = useEditorStore.getState().canvasRect;
                if (!rect) return;

                const clientX = "clientX" in mouseEvent ? mouseEvent.clientX : 0;
                const clientY = "clientY" in mouseEvent ? mouseEvent.clientY : 0;

                const type = active.id;
                useEditorStore.getState().addElementAt(clientX, clientY, type as ElementType);
              }

              setActiveId(null);
            }}
          >
            <div className="flex flex-1 overflow-hidden">
              {/* Левая панель — палитра элементов */}
              <aside className="w-72 border-r border-neutral-800 bg-neutral-900/60 overflow-y-auto">
                <Palette/>
              </aside>

              {/* Центральная область — холст */}
              <main className="flex-1 bg-neutral-950 relative">
                <Canvas/>
              </main>

              {/* Правая панель — свойства */}
              <aside className="w-80 border-l border-neutral-800 bg-neutral-900/60 overflow-y-auto">
                {selectedElement ? (
                  <PropertiesPanel
                    element={selectedElement}
                    updateElement={updateElement}/>
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
                <div
                  className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg shadow-2xl text-sm font-medium opacity-90 scale-110">
                  {activeId}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </div>
  );
}