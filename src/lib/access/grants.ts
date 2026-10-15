import {ADMIN_GRANT, NO_GRANT, type ProjectGrant} from "@/types/access.types";
import type {EditorProject} from "@/lib/pickProjectsFromComponents";

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
