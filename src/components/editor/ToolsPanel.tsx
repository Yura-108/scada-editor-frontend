import React from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {Save, Group, Ungroup, FilePlus, FolderOpen} from "lucide-react";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";
import {usePaletteStore} from "@/store/usePaletteStore";

export default function ToolsPanel({ leftVisible, rightVisible }: { leftVisible: boolean, rightVisible: boolean }) {
  const {selectedIds, exportScene, elements, loadSceneList, createScene, scene} = useEditorStore();
  const {loadPaletteItems} = usePaletteStore();

  const handleLoadSchema = async () => {
    await loadSceneList();
    openChooseSceneModal();
  }

  const handleCreateSchema = async () => {
    await createScene();
    await loadPaletteItems();
  }

  return (
    <nav
      style={{
        left: leftVisible ? '288px' : '0px', // 288px = w-72
        right: rightVisible ? '320px' : '0px', // 320px = w-80
      }}
      className="fixed top-18 z-30 flex gap-3 justify-center items-center px-4 py-2
                 transition-all duration-300 ease-in-out pointer-events-none"
    >
      {/* Название сцены */}
      {scene && (
        <div className="text-sm font-medium text-neutral-400 pointer-events-auto">
          Сцена: <span className="text-neutral-200 font-semibold">{scene.name}</span>
        </div>
      )}

      <div className="flex gap-2 p-1.5 bg-white dark:bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto">

        <button
          onClick={handleCreateSchema}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl
                 bg-white/5 border border-white/10 text-gray-900 dark:text-white
                 hover:bg-white/10 hover:border-white/20
                 active:translate-y-0.5 disabled:opacity-20 transition-all"
        >
          <FilePlus size={16} />
          Создать
        </button>

        <button
          onClick={handleLoadSchema}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl
                 bg-white/5 border border-white/10 text-gray-900 dark:text-white
                 hover:bg-white/10 hover:border-white/20
                 active:translate-y-0.5 disabled:opacity-20 transition-all"
        >
          <FolderOpen size={16} />
          Загрузить
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-1"></div>

        <button
          onClick={() => useEditorStore.getState().groupSelected()}
          disabled={selectedIds.length < 2}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl
                 bg-white/5 border border-white/10 text-gray-900 dark:text-white
                 hover:bg-white/10 hover:border-white/20
                 active:translate-y-0.5 disabled:opacity-20 transition-all"
        >
          <Group size={16} />
          Сгруппировать
        </button>

        <button
          onClick={() => useEditorStore.getState().ungroupSelected()}
          disabled={!selectedIds.some(id => elements.find(e => e.key === id)?.type === "group")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl
                 bg-white/5 border border-white/10 text-gray-900 dark:text-white
                 hover:bg-white/10 hover:border-white/20
                 active:translate-y-0.5 disabled:opacity-20 transition-all"
        >
          <Ungroup size={16} />
          Разгруппировать
        </button>

        <button
          onClick={exportScene}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl
                 bg-indigo-500/20 border border-indigo-400/30 text-indigo-200
                 hover:bg-indigo-500/40 hover:border-indigo-400/50
                 active:translate-y-0.5 transition-all"
        >
          <Save size={16} strokeWidth={2.5} />
          Сохранить
        </button>
      </div>
    </nav>
  );
}

