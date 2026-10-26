"use client";

import {useShallow} from "zustand/react/shallow";
import {toast} from "sonner";
import {Briefcase, Download, FilePlus, FolderOpen, Upload} from "lucide-react";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";
import {openProjectModal} from "@/components/ui/ProjectModal";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useEditorStore} from "../../model/editorStore";
import {exportSceneFile} from "./lib/exportSceneFile";
import {TooltipBtn} from "./TooltipBtn";

interface SceneButtonsProps {
  canEdit: boolean;
  canWrite: boolean;
  onImport: () => void;
}

/** Проект и схема: выбрать проект, создать, загрузить, импорт и экспорт файла. */
export function SceneButtons({canEdit, canWrite, onImport}: SceneButtonsProps) {
  const {currentProject, scene, hasElements, loadSceneList, createScene} = useEditorStore(useShallow(s => ({
    currentProject: s.currentProject, scene: s.scene, hasElements: s.elements.length > 0,
    loadSceneList: s.loadSceneList, createScene: s.createScene,
  })));
  const {loadPaletteItems} = usePaletteStore();

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
    <>
      <TooltipBtn icon={<Briefcase size={16} />} label="Проект" onClick={handleOpenProject} />
      {canWrite && <TooltipBtn icon={<FilePlus size={16} />} label="Создать схему" onClick={handleCreateSchema} />}
      <TooltipBtn icon={<FolderOpen size={16} />} label="Загрузить схему" onClick={handleLoadSchema} />
      <TooltipBtn
        icon={<Upload size={16} />} label="Импорт" onClick={onImport}
        disabled={!canEdit}
      />
      <TooltipBtn
        icon={<Download size={16} />} label="Экспорт в файл" onClick={exportSceneFile}
        disabled={!scene || !hasElements}
      />
    </>
  );
}
