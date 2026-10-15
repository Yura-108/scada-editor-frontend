import type {ProjectGrant} from "@/types/access.types";

/**
 * `access` — права пользователя в проекте из списка проектов. Нет поля — ответ старого
 * бэкенда; тогда прав не знаем и считаем их пустыми (админа поднимает `grantOf`).
 */
export type EditorProject = {id: number; name: string; access?: ProjectGrant};

export function normalizeProjectList(data: unknown): EditorProject[] {
  if (!Array.isArray(data)) return [];

  return data
    .map(toEditorProject)
    .filter((p): p is EditorProject => p !== null);
}

const parseGrant = (raw: unknown): ProjectGrant | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const g = raw as Record<string, unknown>;
  return {
    view: g.view === true,
    operate: g.operate === true,
    edit: g.edit === true,
    level: typeof g.level === "number" ? g.level : null,
  };
};

export function toEditorProject(component: unknown): EditorProject | null {
  if (!component || typeof component !== "object") return null;
  const c = component as {id?: number; name?: string; access?: unknown};
  if (typeof c.id !== "number" || typeof c.name !== "string") return null;
  const access = parseGrant(c.access);
  return access ? {id: c.id, name: c.name, access} : {id: c.id, name: c.name};
}
