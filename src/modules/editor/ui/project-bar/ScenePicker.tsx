"use client";

import {PickerSelect} from "@/shared/ui/PickerSelect";
import {CreateField} from "./CreateField";
import {SceneRowActions} from "./SceneRowActions";
import {useScenePicker} from "./hooks/useScenePicker";

/** Список схем текущего проекта. Без права правки — только выбор. */
export function ScenePicker() {
  const {currentProject, sceneId, sceneList, canWrite, selectScene, create} = useScenePicker();

  return (
    <PickerSelect
      className="min-w-0 max-w-56 shrink"
      ariaLabel="Схема"
      placeholder="Схема…"
      value={sceneId}
      disabled={!currentProject}
      options={sceneList.map(s => ({value: s.id, label: s.name}))}
      onChange={selectScene}
      rowActions={canWrite ? (id) => {
        const scene = sceneList.find(s => s.id === id);
        return scene ? <SceneRowActions scene={scene} /> : null;
      } : undefined}
      footer={canWrite ? <CreateField placeholder="Имя новой схемы" onCreate={create} /> : undefined}
      emptyText={canWrite ? "В этом проекте пока нет схем. Создайте первую ниже." : "В этом проекте пока нет схем."}
    />
  );
}
