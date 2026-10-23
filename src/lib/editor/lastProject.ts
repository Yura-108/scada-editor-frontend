"use client";

import {useEffect, useMemo, useState} from "react";
import {useEditorStore} from "@/modules/editor";
import {useSessionUserStore} from "@/store/useSessionUserStore";
import {canOpenInEditor, grantOf} from "@/lib/access/grants";
import type {EditorProject} from "@/lib/pickProjectsFromComponents";
import {lastProjectId} from "@/lib/editor/projectMemory";

/**
 * Выбрать запомненный проект, если сейчас никакой не выбран и он есть среди `projects` —
 * списка, который видит этот раздел (с учётом прав).
 */
export const restoreLastProject = (projects: EditorProject[]) => {
  const {currentProject, setCurrentProject} = useEditorStore.getState();
  if (currentProject) return;
  const id = lastProjectId();
  const project = id != null ? projects.find(p => p.id === id) : undefined;
  if (project) setCurrentProject(project);
};

/**
 * Проект раздела, которому нужен черновик («просмотр» или «правка»): «Автоматизация», «Данные».
 *
 * `project` — выбранный проект, только если он есть в списке раздела. Проект, выбранный
 * в мониторе (там хватает «управления»), может в этот список не входить — тогда раздел не
 * показывает его данных, а `unavailable` называет его, чтобы объяснить почему.
 */
export function useEditableProject() {
  const allProjects = useEditorStore(s => s.projectList);
  const currentProject = useEditorStore(s => s.currentProject);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  const admin = useSessionUserStore(s => s.admin);
  const [listLoaded, setListLoaded] = useState(false);

  // С одним «управлением» бэкенд ответит 403 на черновик — такие проекты в списке не показываем.
  const projectList = useMemo(
    () => allProjects.filter(p => canOpenInEditor(grantOf(p, admin))),
    [allProjects, admin],
  );

  useEffect(() => {
    let cancelled = false;
    void loadProjectList().then(projects => {
      if (cancelled) return;
      setListLoaded(true);
      if (projects) {
        const isAdmin = useSessionUserStore.getState().admin;
        restoreLastProject(projects.filter(p => canOpenInEditor(grantOf(p, isAdmin))));
      }
    });
    return () => { cancelled = true; };
  }, [loadProjectList]);

  const listed = currentProject != null && projectList.some(p => p.id === currentProject.id);
  return {
    projectList,
    project: listed ? currentProject : null,
    unavailable: listLoaded && currentProject && !listed ? currentProject : null,
    listLoaded,
  };
}
