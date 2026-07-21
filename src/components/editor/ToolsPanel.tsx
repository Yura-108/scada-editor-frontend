import React, {useRef} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {
  Save, Group, Ungroup, FilePlus, FolderOpen, Briefcase, Upload,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
} from "lucide-react";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";
import {openProjectModal} from "@/components/ui/ProjectModal";
import {usePaletteStore} from "@/store/usePaletteStore";
import {toast} from "sonner";

function TooltipBtn({
  icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="relative group/tip">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={className ?? `flex items-center justify-center w-9 h-9 rounded-xl
          bg-white/5 border border-white/10 text-gray-900 dark:text-white
          hover:bg-white/10 hover:border-white/20
          active:translate-y-0.5 disabled:opacity-20 transition-all`}
      >
        {icon}
      </button>
      <span className="
        absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50
        px-2 py-1 text-xs font-medium rounded-lg whitespace-nowrap
        bg-gray-900 dark:bg-gray-700 text-white
        opacity-0 group-hover/tip:opacity-100 pointer-events-none
        transition-opacity duration-150
      ">
        {label}
      </span>
    </div>
  );
}

export default function ToolsPanel({ leftVisible, rightVisible }: { leftVisible: boolean, rightVisible: boolean }) {
  const {selectedIds, exportScene, elements, loadSceneList, createScene, scene, currentProject} = useEditorStore();
  const {loadPaletteItems} = usePaletteStore();
  const importInputRef = useRef<HTMLInputElement>(null);

  // Иерархия Проект -> Схема -> Элементы: блокируем операции над сценой,
  // если она не принадлежит выбранному проекту (или проект/сцена не выбраны).
  const sceneBelongsToProject = !!currentProject
    && !!scene
    && (scene.project_id == null || scene.project_id === currentProject.id);
  const canEdit = sceneBelongsToProject;

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
    if (!sceneBelongsToProject) {
      toast.error("Сцена не принадлежит выбранному проекту");
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!sceneBelongsToProject) {
      toast.error("Сцена не принадлежит выбранному проекту");
      e.target.value = "";
      return;
    }
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
        left: leftVisible ? '288px' : '0px',
        right: rightVisible ? '320px' : '0px',
      }}
      className="fixed top-16 z-30 flex gap-3 justify-center items-center px-4 py-2
                 transition-all duration-300 ease-in-out pointer-events-none"
    >
      {/* Проект и сцена */}
      {(currentProject || scene) && (
        <div className="text-sm font-medium text-neutral-400 pointer-events-auto flex gap-4">
          {currentProject && (
            <span>
              Проект: <span className="text-gray-900 dark:text-gray-100 font-semibold">{currentProject.name}</span>
            </span>
          )}
          {scene && (
            <span>
              Сцена: <span className="text-gray-900 dark:text-gray-100 font-semibold">{scene.name}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex gap-1.5 p-1.5 bg-white dark:bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto">

        <TooltipBtn icon={<Briefcase size={16} />} label="Проект" onClick={handleOpenProject} />
        <TooltipBtn icon={<FilePlus size={16} />} label="Создать сцену" onClick={handleCreateSchema} />
        <TooltipBtn icon={<FolderOpen size={16} />} label="Загрузить сцену" onClick={handleLoadSchema} />
        <TooltipBtn
          icon={<Upload size={16} />} label="Импорт" onClick={handleImport}
          disabled={!canEdit}
        />

        <div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-0.5" />

        <TooltipBtn
          icon={<Group size={16} />}
          label="Сгруппировать"
          onClick={() => useEditorStore.getState().groupSelected()}
          disabled={!canEdit || selectedIds.length < 2}
        />
        <TooltipBtn
          icon={<Ungroup size={16} />}
          label="Разгруппировать"
          onClick={() => useEditorStore.getState().ungroupSelected()}
          disabled={!canEdit || !selectedIds.some(id => elements.find(e => e.key === id)?.type === "group")}
        />

        <div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-0.5" />

        {/* Выравнивание (≥2 выделенных) и распределение (≥3) */}
      {/*  <TooltipBtn*/}
      {/*  icon={<AlignStartVertical size={16} />} label="По левому краю"*/}
      {/*  onClick={() => useEditorStore.getState().alignSelected('left')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 2}*/}
      {/*/>*/}
      {/*  <TooltipBtn*/}
      {/*    icon={<AlignCenterVertical size={16} />} label="По центру (гориз.)"*/}
      {/*    onClick={() => useEditorStore.getState().alignSelected('hcenter')}*/}
      {/*    disabled={!canEdit || selectedIds.length < 2}*/}
      {/*  />*/}
      {/*  <TooltipBtn*/}
      {/*    icon={<AlignEndVertical size={16} />} label="По правому краю"*/}
      {/*    onClick={() => useEditorStore.getState().alignSelected('right')}*/}
      {/*    disabled={!canEdit || selectedIds.length < 2}*/}
      {/*  />*/}
      {/*  <TooltipBtn*/}
      {/*    icon={<AlignStartHorizontal size={16} />} label="По верхнему краю"*/}
      {/*    onClick={() => useEditorStore.getState().alignSelected('top')}*/}
      {/*    disabled={!canEdit || selectedIds.length < 2}*/}
      {/*  />*/}
      {/*  <TooltipBtn*/}
      {/*    icon={<AlignCenterHorizontal size={16} />} label="По центру (верт.)"*/}
      {/*    onClick={() => useEditorStore.getState().alignSelected('vcenter')}*/}
      {/*    disabled={!canEdit || selectedIds.length < 2}*/}
      {/*  />*/}
      {/*  <TooltipBtn*/}
      {/*    icon={<AlignEndHorizontal size={16} />} label="По нижнему краю"*/}
      {/*    onClick={() => useEditorStore.getState().alignSelected('bottom')}*/}
      {/*    disabled={!canEdit || selectedIds.length < 2}*/}
      {/*  />*/}
      {/*  <TooltipBtn*/}
      {/*    icon={<AlignHorizontalSpaceBetween size={16} />} label="Распределить по горизонтали"*/}
      {/*    onClick={() => useEditorStore.getState().distributeSelected('h')}*/}
      {/*    disabled={!canEdit || selectedIds.length < 3}*/}
      {/*  />*/}
      {/*  <TooltipBtn*/}
      {/*    icon={<AlignVerticalSpaceBetween size={16} />} label="Распределить по вертикали"*/}
      {/*    onClick={() => useEditorStore.getState().distributeSelected('v')}*/}
      {/*    disabled={!canEdit || selectedIds.length < 3}*/}
      {/*  />*/}

        <TooltipBtn
          icon={<Save size={16} strokeWidth={2.5} />}
          label="Сохранить"
          onClick={() => exportScene()}
          disabled={!canEdit}
          className="flex items-center justify-center w-9 h-9 rounded-xl
            bg-primary/10 border border-primary/30 text-primary
            hover:bg-primary/20 hover:border-primary/40
            active:translate-y-0.5 transition-all
            disabled:opacity-20 disabled:cursor-not-allowed"
        />
      </div>

      {scene && currentProject && !sceneBelongsToProject && (
        <div className="text-xs font-medium text-red-500 dark:text-red-400 pointer-events-auto">
          Сцена не принадлежит проекту «{currentProject.name}». Выберите сцену из списка.
        </div>
      )}

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
