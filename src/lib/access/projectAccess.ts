import {ADMIN_GRANT, NO_GRANT, type ProjectGrant} from "@/types/access.types";
import type {EditorProject} from "@/lib/pickProjectsFromComponents";
import {useEditorStore} from "@/store/useEditorStore";
import {useSessionUserStore} from "@/store/useSessionUserStore";

/**
 * Права текущего пользователя в проекте. Источник — поле `access` в списке проектов
 * (`GET /api/editor/components/projects`): бэкенд отдаёт только проекты с хоть одной
 * галочкой и сам проставляет администратору полный набор. Флаг админа из токена
 * дополнительно поднимает права до полных — на случай старого ответа без `access`.
 *
 * Всё, что здесь спрятано, — удобство: отказывает бэкенд.
 */
export const grantOf = (project: EditorProject | null | undefined, admin: boolean): ProjectGrant => {
  if (admin) return ADMIN_GRANT;
  return project?.access ?? NO_GRANT;
};

/** Уровень пользователя для действий в мониторе: без `operate` действий нет вовсе. */
export const operateLevelOf = (grant: ProjectGrant): number =>
  grant.operate ? (grant.level ?? 1) : 0;

/** Редактор открывается только с `view` или `edit`; с одним `operate` проект ему чужой. */
export const canOpenInEditor = (grant: ProjectGrant) => grant.view || grant.edit;

/** Уровень, нужный действию; `null` / нет значения — 1. */
export const requiredLevelOf = (level: number | null | undefined): number =>
  typeof level === "number" && level >= 1 ? level : 1;

/** Минимальный уровень для «Опций» и инспектора объекта (`tags/write`, `properties/write`). */
export const DIRECT_WRITE_LEVEL = 9;

/** Права в текущем проекте редактора/монитора (реактивно). */
export const useCurrentProjectGrant = (): ProjectGrant => {
  const admin = useSessionUserStore(s => s.admin);
  const project = useEditorStore(s => s.currentProject);
  const fromList = useEditorStore(s =>
    s.currentProject ? s.projectList.find(p => p.id === s.currentProject!.id) : undefined,
  );
  return grantOf(fromList ?? project, admin);
};

/** То же вне React — для гардов в сторе и движке монитора. */
export const getCurrentProjectGrant = (): ProjectGrant => {
  const {currentProject, projectList} = useEditorStore.getState();
  const fromList = currentProject ? projectList.find(p => p.id === currentProject.id) : undefined;
  return grantOf(fromList ?? currentProject, useSessionUserStore.getState().admin);
};

/** Можно ли править хоть что-то глобальное (рецепты): админ или `edit` хотя бы в одном проекте. */
export const useCanEditAnyProject = (): boolean => {
  const admin = useSessionUserStore(s => s.admin);
  const anyEdit = useEditorStore(s => s.projectList.some(p => p.access?.edit));
  return admin || anyEdit;
};
