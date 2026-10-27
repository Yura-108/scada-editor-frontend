import type {AutobindReport} from "@/types/autobind.types";
// переедет в core/project вместе с остальным lib (шаг 8)
import {parseRuntimeInfo, type ProjectRuntimeInfo} from "@/lib/editor/releasesApi";

/**
 * Ответ запроса: данные или отказ сервера (статус и текст тела). Текст ошибки для
 * пользователя собирает вызывающий — разбор тела бэкенда живёт в модели.
 */
export type ApiResult<T> = {ok: true; data: T} | {ok: false; status: number; text: string};

const failure = async (res: Response, fallback: string): Promise<ApiResult<never>> =>
  ({ok: false, status: res.status, text: await res.text().catch(() => fallback)});

/** Список проектов редактора (сырой ответ — его нормализует `normalizeProjectList`). */
export async function requestProjectList(): Promise<ApiResult<unknown>> {
  const res = await fetch("/api/editor/projects");
  if (!res.ok) return failure(res, "");
  return {ok: true, data: await res.json()};
}

/**
 * Флаг эксплуатации и prod-выпуск проекта. `null` — сервер не ответил по существу
 * (ошибка или неразборчивое тело): это фоновая подробность, не сбой.
 */
export async function requestRuntimeInfo(projectId: number): Promise<ProjectRuntimeInfo | null> {
  const res = await fetch(`/api/editor/projects/${projectId}/runtime`);
  if (!res.ok) return null;
  return parseRuntimeInfo(await res.json().catch(() => null));
}

/** Автопривязка проекта к базе каналов от корня `channelRoot`. */
export async function requestAutobind(projectId: number, channelRoot: string): Promise<ApiResult<AutobindReport>> {
  const res = await fetch(`/api/editor/projects/${projectId}/autobind`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({channel_root: channelRoot}),
  });
  if (!res.ok) return failure(res, "");
  return {ok: true, data: await res.json() as AutobindReport};
}

/** Новый проект (сырой ответ — его разбирает `toEditorProject`). */
export async function requestCreateProject(name: string): Promise<ApiResult<unknown>> {
  const res = await fetch("/api/editor/project", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({name}),
  });
  if (!res.ok) return failure(res, "Ошибка создания проекта");
  return {ok: true, data: await res.json()};
}
