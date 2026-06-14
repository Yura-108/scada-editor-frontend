import React, {useRef} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {Save, Group, Ungroup, FilePlus, FolderOpen, Briefcase, Upload} from "lucide-react";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";
import {openProjectModal} from "@/components/ui/ProjectModal";
import {usePaletteStore} from "@/store/usePaletteStore";
import {toast} from "sonner";

export default function ToolsPanel({ leftVisible, rightVisible }: { leftVisible: boolean, rightVisible: boolean }) {
  const {selectedIds, exportScene, elements, loadSceneList, createScene, scene, currentProject} = useEditorStore();
  const {loadPaletteItems} = usePaletteStore();
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleOpenProject = () => {
    openProjectModal();
  };

  const handleLoadSchema = async () => {
    if (!currentProject) {
      toast.info("Сначала выберите проект");
      openProjectModal();
      return;
    }
    await loadSceneList(currentProject.id);
    openChooseSceneModal();
  };

  const handleImport = () => {
    if (!scene) {
      toast.info("Сначала загрузите или создайте сцену");
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const arr = Array.isArray(json) ? json : [json];
        useEditorStore.getState().importElementsFromJson(arr);
        toast.success(`Импортировано элементов: ${arr.length}`);
      } catch {
        toast.error("Ошибка чтения файла: неверный JSON");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleCreateSchema = async () => {
    if (!currentProject) {
      toast.info("Сначала выберите проект");
      openProjectModal();
      return;
    }
    await createScene();
    await loadPaletteItems();
  };

  return (
    <nav
      style={{
        left: leftVisible ? '288px' : '0px', // 288px = w-72
        right: rightVisible ? '320px' : '0px', // 320px = w-80
      }}
      className="fixed top-18 z-30 flex gap-3 justify-center items-center px-4 py-2
                 transition-all duration-300 ease-in-out pointer-events-none"
    >
      {/* Проект и сцена */}
      {(currentProject || scene) && (
        <div className="text-sm font-medium text-neutral-400 pointer-events-auto flex gap-4">
          {currentProject && (
            <span>
              Проект: <span className="text-neutral-200 font-semibold">{currentProject.name}</span>
            </span>
          )}
          {scene && (
            <span>
              Сцена: <span className="text-neutral-200 font-semibold">{scene.name}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2 p-1.5 bg-white dark:bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto">

        <button
          onClick={handleOpenProject}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl
                 bg-white/5 border border-white/10 text-gray-900 dark:text-white
                 hover:bg-white/10 hover:border-white/20
                 active:translate-y-0.5 disabled:opacity-20 transition-all"
        >
          <Briefcase size={16} />
          Проект
        </button>

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

        <button
          onClick={handleImport}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl
                 bg-white/5 border border-white/10 text-gray-900 dark:text-white
                 hover:bg-white/10 hover:border-white/20
                 active:translate-y-0.5 disabled:opacity-20 transition-all"
        >
          <Upload size={16} />
          Импорт
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
          className="
    flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl
    bg-primary/10 border border-primary/30 text-primary
    hover:bg-primary/20 hover:border-primary/40
    active:translate-y-0.5 transition-all
  "
        >
          <Save size={16} strokeWidth={2.5} />
          Сохранить
        </button>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />
    </nav>
  );
}

