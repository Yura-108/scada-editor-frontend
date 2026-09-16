import {AutomationSaveError} from "@/lib/automation/automationApi";
import type {AutomationTaskTemplate} from "@/types/automationTemplate.types";

/**
 * Палитра шаблонов задач. Ошибки приходят в той же форме, что у набора задач
 * (`400 automation_invalid` со списком `errors[]`), поэтому разбираются тем же
 * `AutomationSaveError` — отдельный класс завести было бы нечем наполнить.
 *
 * Полей версии у шаблонов нет: 409 здесь не бывает, сохранение перезаписывает.
 */

const BASE_URL = "/api/editor/automation-templates";

const readJson = async (res: Response) => res.json().catch(() => null);

const parse = async <T>(res: Response, fallback: string): Promise<T> => {
  const data = await readJson(res);
  if (res.ok) return data as T;
  if (res.status === 400 && data?.error === "automation_invalid") {
    throw new AutomationSaveError("Шаблон не прошёл проверку", data.errors ?? []);
  }
  // 404 приходит в общей форме editor (timestamp/status/error/message), не automation_invalid.
  throw new AutomationSaveError(data?.message ?? `${fallback} (${res.status})`);
};

/** Список приходит целиком и уже отсортирован сервером по имени. */
export const fetchTemplates = async (): Promise<AutomationTaskTemplate[]> => {
  const res = await fetch(BASE_URL);
  const data = await parse<AutomationTaskTemplate[]>(res, "Не удалось загрузить шаблоны задач");
  return Array.isArray(data) ? data : [];
};

export const createTemplate = async (
  template: Omit<AutomationTaskTemplate, "id">,
): Promise<AutomationTaskTemplate> => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(template),
  });
  return parse<AutomationTaskTemplate>(res, "Не удалось сохранить шаблон");
};

export const updateTemplate = async (
  id: number,
  template: Omit<AutomationTaskTemplate, "id">,
): Promise<AutomationTaskTemplate> => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(template),
  });
  return parse<AutomationTaskTemplate>(res, "Не удалось сохранить шаблон");
};

export const deleteTemplate = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE_URL}/${id}`, {method: "DELETE"});
  if (res.ok) return;
  // Повторное удаление того же id — тоже 404; для пользователя это не сбой,
  // а «кто-то удалил раньше», и список всё равно надо перечитать.
  if (res.status === 404) throw new AutomationSaveError("Шаблон уже удалён");
  const data = await readJson(res);
  throw new AutomationSaveError(data?.message ?? `Не удалось удалить шаблон (${res.status})`);
};
