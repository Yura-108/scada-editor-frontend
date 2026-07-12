import {ChevronLeft, ChevronRight, PanelLeft, PanelRight,} from "lucide-react";
import Canvas from "@/components/editor/Canvas";
import {PropertiesPanel} from "@/components/editor/PropertiesPanel";
import {MultiPropertiesPanel} from "@/components/editor/MultiPropertiesPanel";
import {LayersPanel} from "@/components/editor/LayersPanel";
import {useEditorStore} from "@/store/useEditorStore";
import React, {useMemo, useState} from "react";
import Palette from "./Palette";
import ToolsPanel from "@/components/editor/ToolsPanel";
import {cn} from "@/lib/utils";

export default function WorkSpace() {
  // Точечные селекторы вместо подписки на весь стор: иначе каждый тик пана/зума
  // ре-рендерил WorkSpace и каскадом весь Canvas со всеми фигурами.
  const selectedIds = useEditorStore(s => s.selectedIds);
  const selectedElement = useEditorStore(s => s.elements.find(el => el.key === s.selectedIds[0]));
  const elements = useEditorStore(s => s.elements);

  const selectedElements = useMemo(
    () => selectedIds.map(id => elements.find(el => el.key === id)).filter((el): el is NonNullable<typeof el> => Boolean(el)),
    [selectedIds, elements],
  );

  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [leftTab, setLeftTab] = useState<"palette" | "layers">("palette");

  const leftTabButton = (tab: "palette" | "layers", title: string) => (
    <button
      onClick={() => setLeftTab(tab)}
      className={cn(
        "flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
        leftTab === tab
          ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 border-b-2 border-transparent",
      )}
    >
      {title}
    </button>
  );

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
        <div className="h-full w-full flex flex-col">
          {/* Вкладки левой панели: Палитра / Слои */}
          <div className="flex shrink-0 border-b border-neutral-200 dark:border-neutral-800">
            {leftTabButton("palette", "Палитра")}
            {leftTabButton("layers", "Слои")}
          </div>
          <div className="flex-1 overflow-y-auto">
            {leftTab === "palette" ? <Palette /> : <LayersPanel />}
          </div>
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
          ) : selectedElements.length > 1 ? (
            <MultiPropertiesPanel elements={selectedElements} />
          ) : (
            <div className="h-full flex flex-col items-center text-center p-6">
              <div className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">Выберите элемент</div>
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

