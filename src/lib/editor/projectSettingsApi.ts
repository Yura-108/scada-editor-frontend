/**
 * `image` проекта — непрозрачный JSON, в котором фронт хранит настройки проекта (сейчас — общие
 * закреплённые схемы). Контракт: docs/contract/2026-09-30-project-image-contract.md.
 *
 * Читается из списка проектов (`image` у каждого проекта), пишется `PUT …/projects/{id}/image`.
 * Формат принадлежит фронту: бэкенд хранит объект целиком, последняя запись побеждает.
 */

export type ProjectSettings = Record<string, unknown>;

/** Бэкенд ещё не знает `image` проекта — работаем по-старому, локально. */
export class ProjectSettingsUnsupported extends Error {
  constructor() {
    super("image проекта не поддерживается бэкендом");
    this.name = "ProjectSettingsUnsupported";
  }
}

const UNSUPPORTED = new Set([404, 405, 501]);

/** `image` бывает объектом или (если бэк отдаёт строку состояния как есть) JSON-строкой. */
const asObject = (raw: unknown): ProjectSettings => {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as ProjectSettings : {};
};

/**
 * `image` проекта из списка проектов. Поля `image` в ответе нет вовсе — бэк старый
 * (`ProjectSettingsUnsupported`); `null` — ещё ничего не записывали (`{}`).
 */
export async function fetchProjectSettings(projectId: number, signal?: AbortSignal): Promise<ProjectSettings> {
  const res = await fetch("/api/editor/projects", {signal});
  if (!res.ok) throw new Error(`Не удалось загрузить список проектов (${res.status})`);
  const list = await res.json().catch(() => null);
  const project = Array.isArray(list)
    ? (list as Record<string, unknown>[]).find(p => Number(p?.id) === projectId)
    : undefined;
  if (!project || !("image" in project)) throw new ProjectSettingsUnsupported();
  return asObject(project.image);
}

/**
 * Записать один ключ `image`, не потеряв остальные: перечитать, слить, записать целиком.
 * Между чтением и записью чужая правка другого ключа может потеряться — для настроек рабочего
 * места это приемлемо (контракт: последняя запись побеждает).
 */
export async function saveProjectSetting(projectId: number, key: string, value: unknown): Promise<ProjectSettings> {
  const current = await fetchProjectSettings(projectId);
  const res = await fetch(`/api/editor/projects/${projectId}/image`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({image: {...current, [key]: value}}),
  });
  if (!res.ok) {
    if (UNSUPPORTED.has(res.status)) throw new ProjectSettingsUnsupported();
    const body = await res.json().catch(() => null) as {message?: string} | null;
    throw new Error(body?.message || `Не удалось сохранить закрепления проекта (${res.status})`);
  }
  return asObject((await res.json().catch(() => null) as {image?: unknown} | null)?.image);
}
