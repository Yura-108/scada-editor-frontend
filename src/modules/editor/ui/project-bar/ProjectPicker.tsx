"use client";

import {PickerSelect} from "@/shared/ui/PickerSelect";
import {CreateField} from "./CreateField";
import {ProjectRowActions} from "./ProjectRowActions";
import {useProjectPicker} from "./hooks/useProjectPicker";

/** Список проектов редактора. Действия с проектом — кнопками в его строке. */
export function ProjectPicker() {
  const {projects, currentProject, admin, selectProject, createAndSelect} = useProjectPicker();

  return (
    <PickerSelect
      className="min-w-0 max-w-48 shrink"
      ariaLabel="Проект"
      placeholder="Проект…"
      value={currentProject?.id ?? null}
      options={projects.map(p => ({value: p.id, label: p.name}))}
      onChange={(id) => void selectProject(id)}
      rowActions={(id) => {
        const project = projects.find(p => p.id === id);
        return project ? <ProjectRowActions project={project} admin={admin} /> : null;
      }}
      // Создавать проект может только администратор (иначе 403 NOT_ADMIN).
      footer={admin ? <CreateField placeholder="Имя нового проекта" onCreate={createAndSelect} /> : undefined}
      emptyText={admin
        ? "Проектов пока нет. Создайте первый ниже."
        : "Нет проектов, доступных для просмотра или правки. Права выдаёт администратор."}
    />
  );
}
