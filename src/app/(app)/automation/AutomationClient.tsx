"use client";

import React from "react";
import {useEditorStore, useEditableProject} from "@/modules/editor";
import {AutomationPage} from "@/modules/automation";

/**
 * Страница «Автоматизация»: сам раздел — `AutomationPage` из `@/modules/automation`, здесь только
 * проект. Проект живёт в сторе редактора, а модуль автоматизации редактор не импортирует.
 */
export default function AutomationClient() {
  // Страница читает черновик проекта — нужен «просмотр» или «правка». Проект, выбранный в
  // мониторе только с «управлением», сюда не попадает: его данных раздел не показывает.
  const {projectList, project, unavailable, listLoaded} = useEditableProject();
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);

  return (
    <AutomationPage
      projectList={projectList}
      project={project}
      unavailable={unavailable}
      listLoaded={listLoaded}
      onSelectProject={setCurrentProject}
    />
  );
}
