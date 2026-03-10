import React from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {Save, Group, Ungroup} from "lucide-react";

export default function ToolsPanel({ leftVisible, rightVisible }: { leftVisible: boolean, rightVisible: boolean }) {
  const {selectedIds, exportScene, elements} = useEditorStore();

  return (
    <nav
      style={{
        // Динамические отступы, чтобы панель всегда была МЕЖДУ асайдами
        left: leftVisible ? '288px' : '0px', // 288px = w-72
        right: rightVisible ? '320px' : '0px', // 320px = w-80
      }}
      className="fixed top-18 z-30 flex gap-3 justify-center items-center px-4 py-2
                 transition-all duration-300 ease-in-out pointer-events-none"
    >
      {/* Обертка с pointer-events-auto, чтобы кнопки нажимались, но пространство вокруг — нет */}
      <div className="flex gap-2 p-1.5 bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto">

        <button
          onClick={() => useEditorStore.getState().groupSelected()}
          disabled={selectedIds.length < 2}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl
                 bg-white/5 border border-white/10 text-white
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
                 bg-white/5 border border-white/10 text-white
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