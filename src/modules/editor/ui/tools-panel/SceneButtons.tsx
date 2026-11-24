"use client";

import {useShallow} from "zustand/react/shallow";
import {Download, Upload} from "lucide-react";
import {useEditorStore} from "../../model/editorStore";
import {exportSceneFile} from "./lib/exportSceneFile";
import {TooltipBtn} from "./TooltipBtn";

interface SceneButtonsProps {
  canEdit: boolean;
  onImport: () => void;
}

/**
 * Схема в файл и из файла: импорт и экспорт. Выбор и создание проекта и схемы — в шапке
 * редактора (`ProjectPicker`, `ScenePicker`).
 */
export function SceneButtons({canEdit, onImport}: SceneButtonsProps) {
  const {scene, hasElements} = useEditorStore(useShallow(s => ({
    scene: s.scene, hasElements: s.elements.length > 0,
  })));

  return (
    <>
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
