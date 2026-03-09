import React from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {Save} from "lucide-react";

export default function ToolsPanel() {
  const {selectedIds, exportScene} = useEditorStore();
  return (
    <nav className="flex gap-4 justify-start items-center p-2 bg-[#0a0a0a]">
      <button
        onClick={() => useEditorStore.getState().groupSelected()}
        disabled={selectedIds.length < 2}
        className="group relative px-4 py-2 text-sm font-medium rounded-xl
               bg-white/10 backdrop-blur-md border border-white/20
               text-white
               hover:bg-white/20 hover:border-white/30
               active:shadow-none active:translate-y-0.5
               disabled:opacity-30 disabled:pointer-events-none disabled:translate-y-0
               transition-all duration-150 ease-out"
      >
        Сгруппировать
      </button>

      <button
        onClick={() => useEditorStore.getState().ungroupSelected()}
        disabled={!selectedIds.some(id => {
          const el = useEditorStore.getState().elements.find(e => e.key === id);
          return el?.type === "group";
        })}
        className="group relative px-4 py-2 text-sm font-medium rounded-xl
               bg-white/10 backdrop-blur-md border border-white/20
               text-white
               hover:bg-white/20 hover:border-white/30
               active:shadow-none active:translate-y-0.5
               disabled:opacity-30 disabled:pointer-events-none disabled:translate-y-0
               transition-all duration-150 ease-out"
      >
        Разгруппировать
      </button>

      <button
        onClick={exportScene}
        className="group relative flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-xl
               bg-indigo-500/30 backdrop-blur-lg border border-indigo-400/40
               text-indigo-100
               hover:bg-indigo-500/40 hover:border-indigo-400/60
               active:shadow-none active:translate-y-0.5
               transition-all duration-150 ease-out"
      >
        <Save size={16} strokeWidth={2.5} />
        Сохранить
      </button>
    </nav>
  )
}