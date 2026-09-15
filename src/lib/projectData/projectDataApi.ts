import type {
  ProjectDataSaveRequest,
  ProjectDataSet,
  ProjectDataValidationError,
} from "@/types/projectData.types";
import type {VersionSummary} from "@/types/editorVersion.types";
import {fetchVersions} from "@/lib/editor/versionsApi";

/** Ошибка сохранения таблиц: список нарушений проверки или конфликт версий. */
export class ProjectDataSaveError extends Error {
  constructor(
    message: string,
    readonly errors: ProjectDataValidationError[] = [],
    readonly conflict = false,
  ) {
    super(message);
    this.name = "ProjectDataSaveError";
  }
}

const readJson = async (res: Response) => res.json().catch(() => null);

export const fetchProjectData = async (projectId: number): Promise<ProjectDataSet> => {
  const res = await fetch(`/api/editor/data/${projectId}`);
  if (!res.ok) throw new Error(`Не удалось загрузить данные проекта (${res.status})`);
  return res.json();
};

/**
 * Сохраняет набор таблиц целиком. `version` — версия, на которой основан черновик:
 * для ни разу не сохранённого набора `based_on_version` не отправляется вовсе.
 */
export const saveProjectData = async (
  projectId: number,
  version: number | null,
  tables: ProjectDataSaveRequest["tables"],
): Promise<ProjectDataSet> => {
  const body: ProjectDataSaveRequest = version === null ? {tables} : {based_on_version: version, tables};
  const res = await fetch(`/api/editor/data/${projectId}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (res.ok) return data as ProjectDataSet;
  if (res.status === 400 && data?.error === "project_data_invalid") {
    throw new ProjectDataSaveError("Таблицы не прошли проверку", data.errors ?? []);
  }
  if (res.status === 409) {
    throw new ProjectDataSaveError("Таблицы уже изменил кто-то другой — перечитайте их", [], true);
  }
  throw new ProjectDataSaveError(data?.message ?? `Не удалось сохранить таблицы (${res.status})`);
};

/**
 * Просит automation перечитать сохранённые данные. 404 — не ошибка: проект сейчас не
 * исполняется, и данные подхватятся сами при его запуске.
 */
export const reloadProjectData = async (projectId: number): Promise<"applied" | "not_running"> => {
  const res = await fetch(`/api/automation/projects/${projectId}/data/reload`, {method: "POST"});
  if (res.ok) return "applied";
  if (res.status === 404) return "not_running";
  const data = await readJson(res);
  throw new Error(data?.message ?? `Не удалось применить данные (${res.status})`);
};

export const fetchProjectDataVersions = (projectId: number): Promise<VersionSummary[]> =>
  fetchVersions("data", projectId);

/** Откат: бэкенд записывает содержимое версии новой версией. */
export const restoreProjectDataVersion = async (projectId: number, versionNo: number): Promise<void> => {
  const res = await fetch(`/api/editor/history/data/${projectId}/restore/${versionNo}`, {method: "POST"});
  if (res.ok) return;
  const data = await readJson(res);
  // Старая версия может не пройти нынешние правила — причина тогда лежит в errors.
  if (data?.error === "project_data_invalid" && Array.isArray(data.errors) && data.errors.length) {
    const details = (data.errors as ProjectDataValidationError[])
      .slice(0, 3)
      .map(e => `${e.table ? `${e.table} · ` : ""}${e.field}: ${e.message}`)
      .join("; ");
    throw new Error(`Версия ${versionNo} не проходит проверку: ${details}`);
  }
  throw new Error(data?.message ?? `Не удалось восстановить версию (${res.status})`);
};
