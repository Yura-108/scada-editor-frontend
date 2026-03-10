"use client";

import {
  DndContext,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {useEffect, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {DiagramElement, ElementType} from "@/types/editorElement.type";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";
import WorkSpace from "@/components/WorkSpace";

export default function EditorPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const {
    scene,
    createScene,
    loadSceneList
  } = useEditorStore();

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
  // useEffect(() => {
  //   const timeout = setTimeout(() => {
  //     exportScene();
  //   }, 5000);
  //
  //   return () => clearTimeout(timeout);
  // }, [elements, exportScene]);

  const handleLoadSchema = async () => {
    await loadSceneList();
    openChooseSceneModal();
  }

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
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
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id as string)}
          onDragEnd={(event) => {
            const { over, active } = event;

            if (over?.id === "canvas") {
              const { camera, canvasRect } = useEditorStore.getState();
              const translatedRect = active.rect.current.translated;

              if (translatedRect && canvasRect) {
                // 1. Находим координаты относительно верхнего левого угла ВЬЮПОРТА (без всяких / 2)
                const localX = translatedRect.left - canvasRect.left;
                const localY = translatedRect.top - canvasRect.top;

                // 2. Переводим локальные координаты в координаты МИРА (с учетом зума и камеры)
                // Формула: World = (Local - CameraOffset) / Zoom
                const worldX = (localX - camera.x) / camera.zoom;
                const worldY = (localY - camera.y) / camera.zoom;

                // Теперь проверка на выход за границы (если холст 5000x5000)
                if (worldX < 0 || worldY < 0 || worldX > 5000 || worldY > 5000) return;

                const type = active.id as ElementType;
                const template = active.data.current as DiagramElement[];
                if (type === 'custom') {
                  useEditorStore.getState().addTemplate(worldX, worldY, template);
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
                className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg shadow-2xl text-sm font-medium opacity-90 scale-110">
                {activeId}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}