import {useEffect, useMemo} from "react";
import {useShallow} from "zustand/react/shallow";
import {canOpenInEditor, grantOf} from "@/lib/access/projectAccess";
import {useSessionUserStore} from "@/store/useSessionUserStore";
import {useEditorStore} from "../../../model/editorStore";
import {confirmDropUnsaved} from "../lib/confirmDropUnsaved";

/** Список проектов редактора: только доступные редактору, выбор, создание. */
export function useProjectPicker() {
  const {allProjects, currentProject, loadProjectRuntimeFlag, createProject} = useEditorStore(useShallow(s => ({
    allProjects: s.projectList, currentProject: s.currentProject,
    loadProjectRuntimeFlag: s.loadProjectRuntimeFlag, createProject: s.createProject,
  })));
  const admin = useSessionUserStore(s => s.admin);

  // С одним «управлением» проект в редакторе не открывается (бэкенд ответит 403) — не
  // показываем его вовсе. Список стора остаётся полным: он же кормит монитор.
  // useMemo: от списка зависит эффект ниже, новый массив на каждый рендер зациклил бы его.
  const projects = useMemo(
    () => allProjects.filter(p => canOpenInEditor(grantOf(p, admin))),
    [allProjects, admin],
  );

  // Флаг эксплуатации приходит отдельным эндпоинтом на каждый проект: в списке проектов
  // бэкенд его не отдаёт. Список короткий, поэтому спрашиваем по одному.
  useEffect(() => {
    for (const p of projects) void loadProjectRuntimeFlag(p.id);
  }, [projects, loadProjectRuntimeFlag]);

  const selectProject = async (id: number) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    // setCurrentProject выбрасывает документ открытой схемы. Со списком смена проекта стоит
    // один клик — промахнуться легко, поэтому спрашиваем, как и при смене схемы.
    if (!await confirmDropUnsaved("Перейти к другому проекту?", "Перейти")) return;
    const {setCurrentProject, loadSceneList} = useEditorStore.getState();
    // setCurrentProject сбрасывает sceneList в [] — схемы прошлого проекта не утекут.
    setCurrentProject(project);
    await loadSceneList(project.id);
  };

  /** @returns создан ли проект — по нему футер решает, очищать ли поле. */
  const createAndSelect = async (name: string): Promise<boolean> => {
    if (!await confirmDropUnsaved("Создать новый проект и перейти к нему?", "Создать")) return false;
    const created = await createProject(name);
    if (!created) return false;
    // Схем у только что созданного проекта нет — список не запрашиваем: для «пустого»
    // project_id бэкенд может вернуть чужие схемы, и открылся бы «другой проект».
    useEditorStore.getState().setCurrentProject({id: created.id, name: created.name});
    return true;
  };

  return {projects, currentProject, admin, selectProject, createAndSelect};
}
