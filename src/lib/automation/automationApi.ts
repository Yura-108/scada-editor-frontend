import type {
  AutomationSaveRequest,
  AutomationSet,
  AutomationTaskStatusRow,
  AutomationValidationError,
} from "@/types/automation.types";
import type {VersionSummary} from "@/types/editorVersion.types";
import {fetchVersions} from "@/lib/editor/versionsApi";

/** Ошибка сохранения набора: список нарушений проверки или конфликт версий. */
export class AutomationSaveError extends Error {
  constructor(
    message: string,
    readonly errors: AutomationValidationError[] = [],
    readonly conflict = false,
  ) {
    super(message);
    this.name = "AutomationSaveError";
  }
}

const readJson = async (res: Response) => res.json().catch(() => null);

export const fetchAutomation = async (projectId: number): Promise<AutomationSet> => {
  const res = await fetch(`/api/editor/automation/${projectId}`);
  if (!res.ok) throw new Error(`Не удалось загрузить автоматизацию проекта (${res.status})`);
  return res.json();
};

export const saveAutomation = async (projectId: number, body: AutomationSaveRequest): Promise<AutomationSet> => {
  const res = await fetch(`/api/editor/automation/${projectId}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (res.ok) return data as AutomationSet;
  if (res.status === 400 && data?.error === "automation_invalid") {
    throw new AutomationSaveError("Набор не прошёл проверку", data.errors ?? []);
  }
  if (res.status === 409) {
    throw new AutomationSaveError("Набор уже изменил кто-то другой — перечитайте его", [], true);
  }
  throw new AutomationSaveError(data?.message ?? `Не удалось сохранить набор (${res.status})`);
};

export const republishAutomation = async (projectId: number): Promise<void> => {
  const res = await fetch(`/api/editor/automation/${projectId}/republish`, {method: "POST"});
  if (!res.ok) throw new Error(`Не удалось переопубликовать набор (${res.status})`);
};

export const fetchAutomationVersions = (projectId: number): Promise<VersionSummary[]> =>
  fetchVersions("automation", projectId);

/** Откат: бэкенд записывает содержимое версии новой версией и публикует его в automation. */
export const restoreAutomationVersion = async (projectId: number, versionNo: number): Promise<void> => {
  const res = await fetch(`/api/editor/history/automation/${projectId}/restore/${versionNo}`, {method: "POST"});
  if (!res.ok) {
    const data = await readJson(res);
    // Восстановление проходит ту же проверку, что и сохранение: старая версия может не пройти
    // нынешние правила, и тогда причина лежит в errors, а message нет вовсе.
    if (data?.error === "automation_invalid" && Array.isArray(data.errors) && data.errors.length) {
      const details = (data.errors as AutomationValidationError[])
        .slice(0, 3)
        .map(e => `${e.task ? `${e.task} · ` : ""}${e.field}: ${e.message}`)
        .join("; ");
      throw new Error(`Версия ${versionNo} не проходит проверку: ${details}`);
    }
    throw new Error(data?.message ?? `Не удалось восстановить версию (${res.status})`);
  }
};

export const fetchTaskStatuses = async (projectId: number): Promise<AutomationTaskStatusRow[]> => {
  const res = await fetch(`/api/automation/projects/${projectId}/tasks`);
  if (!res.ok) return [];
  const data = await readJson(res);
  return Array.isArray(data) ? data : [];
};
