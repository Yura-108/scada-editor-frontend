import {ChevronLeft, ChevronRight, PanelLeft, PanelRight,} from "lucide-react";
import Canvas from "@/components/editor/Canvas";
import {PropertiesPanel} from "@/components/editor/PropertiesPanel";
import {useEditorStore} from "@/store/useEditorStore";
import React, {useState} from "react";
import Palette from "./Palette";
import ToolsPanel from "@/components/editor/ToolsPanel";
import {getRenderedElement} from "@/lib/getRenderedElement";

export default function WorkSpace() {
  const {elements, selectedIds, updateElement} = useEditorStore();
  const selectedElement = elements.find(el => el.key === selectedIds[0]);

  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);

  return (
    // 1. Главный контейнер фиксируем на весь экран. Он блокирует любой внешний скролл.
    <div className="fixed inset-0 overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200">

      {/* Центральная область (Холст). Занимает 100% места, находится под панелями (z-0) */}
      <main className="absolute inset-0 flex flex-col z-0">
        <ToolsPanel leftVisible={leftVisible} rightVisible={rightVisible} />
        <Canvas />
      </main>

      {/* Левая панель - Абсолютная, прилипшая к левому краю */}
      <aside
        className={`absolute left-0 top-16 bottom-0 z-40 w-72 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md transition-transform duration-300 ease-in-out ${
          leftVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full w-full overflow-y-auto">
          <Palette />
        </div>

        {/* Кнопка СВЕРНУТЬ левую панель */}
        <button
          onClick={() => setLeftVisible(false)}
          className={`absolute top-[50%] -right-8 p-2 text-neutral-600 dark:text-neutral-400 hover:text-gray-900 dark:text-white transition-opacity ${
            leftVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronLeft size={24} />
        </button>

        {/* Кнопка РАЗВЕРНУТЬ левую панель (висит снаружи) */}
        <button
          onClick={() => setLeftVisible(true)}
          className={`absolute top-4 -right-12 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-r-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:bg-neutral-800 shadow-xl transition-opacity ${
            !leftVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <PanelLeft size={20} />
        </button>
      </aside>

      {/* Правая панель - Абсолютная, прилипшая к правому краю */}
      <aside
        className={`absolute right-0 top-16 bottom-0 z-40 w-80 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md transition-transform duration-300 ease-in-out ${
          rightVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full w-full overflow-y-auto">
          {selectedElement && selectedIds.length === 1 ? (
            <PropertiesPanel element={selectedElement} />
          ) : (
            <div className="h-full flex flex-col items-center text-center p-6">
              <div className="text-neutral-500 text-sm font-medium">Выберите один элемент</div>
            </div>
          )}
        </div>

        {/* Кнопка СВЕРНУТЬ правую панель */}
        <button
          onClick={() => setRightVisible(false)}
          className={`absolute top-[50%] -left-8 p-1 text-neutral-600 dark:text-neutral-400 hover:text-gray-900 dark:text-white transition-opacity ${
            rightVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronRight size={24} />
        </button>

        {/* Кнопка РАЗВЕРНУТЬ правую панель */}
        <button
          onClick={() => setRightVisible(true)}
          className={`absolute top-4 -left-12 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-l-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:bg-neutral-800 shadow-xl transition-opacity ${
            !rightVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <PanelRight size={18} />
        </button>
      </aside>

    </div>
  );
}

