import {ChevronLeft, ChevronRight, PanelLeft, PanelRight, Save} from "lucide-react";
import Canvas from "@/components/Canvas";
import {PropertiesPanel} from "@/components/PropertiesPanel";
import {useEditorStore} from "@/store/useEditorStore";
import React, {useState} from "react";
import Palette from "./Palette";
import ToolsPanel from "@/components/ToolsPanel";

export default function WorkSpace() {
  const {elements, selectedIds, updateElement, exportScene} = useEditorStore();
  const selectedElement = elements.find(el => el.key === selectedIds[0]);

  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-950 text-neutral-200">

      {/* Левая панель */}
      <aside
        className={`relative border-r border-neutral-800 bg-neutral-900/60 transition-all duration-300 ease-in-out z-20 ${
          leftVisible ? 'w-72' : 'w-0'
        }`}
      >
        {/* Обертка для контента с прокруткой */}
        <div className={`h-full w-72 overflow-y-auto transition-opacity duration-300 ${
          leftVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <Palette />

          {/* Кнопка СВЕРНУТЬ (внутри контента) */}
          <button
            onClick={() => setLeftVisible(false)}
            className="absolute top-4 -right-8 p-2 hover:text-white rounded text-neutral-400"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        {!leftVisible && (
          <button
            onClick={() => setLeftVisible(true)}
            className="absolute top-4 -right-12 z-50 p-2 bg-neutral-900 border border-neutral-800 rounded-r-md hover:bg-neutral-800 text-neutral-400 shadow-xl"
          >
            <PanelLeft size={20} />
          </button>
        )}
      </aside>


      {/* Центральная область */}
      <main className="flex flex-col flex-1 relative bg-neutral-950 transition-all">
        <ToolsPanel />
        <Canvas />
      </main>

      {/* Правая панель */}
      <aside
        className={`relative border-l border-neutral-800 bg-neutral-900/60 transition-all duration-300 ease-in-out ${
          rightVisible ? 'w-80' : 'w-0 translate-x-full'
        }`}
      >
        <div className={`${!rightVisible && 'invisible'} h-full w-80`}>
          {selectedElement ? (
            <PropertiesPanel element={selectedElement} updateElement={updateElement}/>
          ) : (
            <div className="h-full flex flex-col items-center text-center p-6">
              <div className="text-neutral-500 text-sm font-medium">Выберите элемент</div>
            </div>
          )}
        </div>

        {/* Кнопка раскрытия правой панели */}
        {!rightVisible && (
          <button
            onClick={() => setRightVisible(true)}
            className="absolute top-4 -left-12 z-50 p-2 bg-neutral-900 border border-neutral-800 rounded-l-md hover:bg-neutral-800 text-neutral-400 shadow-xl"
          >
            <PanelRight size={18} />
          </button>
        )}

        {/* Кнопка скрытия */}
        {rightVisible && (
          <button
            onClick={() => setRightVisible(false)}
            className="absolute top-4 -left-8 z-50 p-1 hover:text-white rounded"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </aside>
    </div>
  );
}