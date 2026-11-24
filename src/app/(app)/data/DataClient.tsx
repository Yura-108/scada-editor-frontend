"use client";

import React from "react";
import {useEditorStore, useEditableProject} from "@/modules/editor";
import {DataPage} from "@/modules/data";

/**
 * Страница «Данные проекта»: сам раздел — `DataPage` из `@/modules/data`, здесь только проект.
 * Проект живёт в сторе редактора, а модуль данных редактор не импортирует.
 */
export default function DataClient() {
  // Страница читает черновик проекта — нужен «просмотр» или «правка». Проект, выбранный в
  // мониторе только с «управлением», сюда не попадает: его данных раздел не показывает.
  const {projectList, project, unavailable, listLoaded} = useEditableProject();
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);

  return (
    <DataPage
      projectList={projectList}
      project={project}
      unavailable={unavailable}
      listLoaded={listLoaded}
      onSelectProject={setCurrentProject}
    />
  );
}
