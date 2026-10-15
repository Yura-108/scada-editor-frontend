import type {ProjectGrant} from "@/types/access.types";
import {readBackendError} from "@/lib/access/accessErrors";

/**
 * Админка auth (`/api/auth/admin/**`, только администратору — иначе 403 NOT_ADMIN).
 * Ошибки auth — `{message}` (409 «логин занят», «последний администратор») либо отказ
 * `{error: "FORBIDDEN", reason}`; оба переводит `readBackendError`.
 */

export interface AdminUser {
  id: number;
  login: string;
  admin: boolean;
  enabled: boolean;
}

/** Права пользователя по проектам: проекта нет в ответе — прав там нет. */
export type UserGrants = Record<number, ProjectGrant>;

const BASE = "/api/auth/admin";

const request = async (path: string, init?: RequestInit): Promise<Response> => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: init?.body ? {"Content-Type": "application/json", ...init.headers} : init?.headers,
  });
  if (!res.ok) throw new Error(await readBackendError(res));
  return res;
};

const json = <T>(res: Response): Promise<T> => res.json() as Promise<T>;

export const listUsers = async (): Promise<AdminUser[]> => json(await request("/users"));

/** `POST /users` отвечает 200 с созданным пользователем. */
export const createUser = async (login: string, password: string, admin: boolean): Promise<AdminUser> =>
  json(await request("/users", {method: "POST", body: JSON.stringify({login, password, admin})}));

/** Оба поля обязательны (`@NotNull`): шлём полный набор, даже меняя одно. */
export const updateUser = async (id: number, patch: {enabled: boolean; admin: boolean}): Promise<AdminUser> =>
  json(await request(`/users/${id}`, {method: "PUT", body: JSON.stringify(patch)}));

export const resetUserPassword = async (id: number, password: string): Promise<void> => {
  await request(`/users/${id}/password`, {method: "PUT", body: JSON.stringify({password})});
};

export const deleteUser = async (id: number): Promise<void> => {
  await request(`/users/${id}`, {method: "DELETE"});
};

export const fetchUserGrants = async (id: number): Promise<UserGrants> => {
  const raw = await json<Record<string, Partial<ProjectGrant>>>(await request(`/users/${id}/projects`));
  const out: UserGrants = {};
  for (const [projectId, g] of Object.entries(raw ?? {})) {
    out[Number(projectId)] = {
      view: g.view === true,
      operate: g.operate === true,
      edit: g.edit === true,
      level: typeof g.level === "number" ? g.level : null,
    };
  }
  return out;
};

/**
 * Права в одном проекте. Уровень осмыслен только с «управлением»: без него не шлём, с ним —
 * не меньше 1 (бэкенд так и сохранил бы). Все галочки сняты — права в проекте удаляются.
 */
export const putUserGrant = async (id: number, projectId: number, grant: ProjectGrant): Promise<void> => {
  const body = {...grant, level: grant.operate ? (grant.level ?? 1) : null};
  await request(`/users/${id}/projects/${projectId}`, {method: "PUT", body: JSON.stringify(body)});
};

export const fetchBranches = async (projectId: number): Promise<string[]> =>
  json(await request(`/projects/${projectId}/branches`));

/** Список заменяется целиком; пустые строки и дубли бэкенд отбрасывает сам. */
export const putBranches = async (projectId: number, branches: string[]): Promise<void> => {
  await request(`/projects/${projectId}/branches`, {method: "PUT", body: JSON.stringify(branches)});
};

/** «Обновить права на сервисах» — перепубликовать права из базы auth. */
export const resyncAccess = async (): Promise<void> => {
  await request("/resync", {method: "POST"});
};
