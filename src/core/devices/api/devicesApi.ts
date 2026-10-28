import type {DeviceParamsLayoutType} from "@/types/nodeTypes";
import type {NodeParamType, NodeType} from "@/types/channelsTypes";
import {describeDenial, errorTextFromJson, isAccessDenial} from "@/core/access";

/**
 * Запросы базы каналов (`/api/device/*`, блокировки `/api/lock`, `/api/unlock`).
 * Сторы и действия зовут их и сами решают, что показать пользователю.
 */

/**
 * Разбирает ответ и бросает ошибку с сообщением бэкенда при не-2xx.
 *
 * Мутации базы каналов раньше вообще не проверяли `res.ok`: тело ошибки
 * парсилось как DTO и подмешивалось в состояние как настоящий узел
 * (`nodeDTO.key.split` падал с TypeError), либо изменение молча не применялось.
 */
const parseOk = async <T>(res: Response, fallback: string): Promise<T> => {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // тело не JSON — сообщение возьмём из текста
  }

  if (!res.ok) {
    // Отказ по веткам каталога — `{error: "FORBIDDEN", reason: "PATH_NOT_ALLOWED"}`.
    if (isAccessDenial(body)) throw new Error(describeDenial(body));
    const message =
      (body && typeof body === "object" && typeof (body as {message?: unknown}).message === "string"
        ? (body as {message: string}).message
        : "") || text.slice(0, 200) || `${fallback} (${res.status})`;
    throw new Error(message);
  }

  return body as T;
};

export const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export type DeviceTemplateList = {templates: {key: number; value: string}[]};

export const fetchParamLayout = async (): Promise<DeviceParamsLayoutType[]> => {
  const res = await fetch('/api/device/param/layout');
  const data: { descriptions: DeviceParamsLayoutType[] } = await res.json();
  return data.descriptions;
};

/** Узлы и параметры проекта целиком (без собственных параметров самого проекта). */
export const fetchFullHierarchy = async (project: string) => {
  const res = await fetch(`/api/device/fullHierarchy?project=${encodeURIComponent(project)}`);

  if (!res.ok) {
    throw new Error(`Ошибка загрузки: ${project}`);
  }

  const json: {nodes: {key: string}[], params: NodeParamType[]} = await res.json();
  return json;
};

/** Прямые дети площадки с параметрами; null — ответ не 2xx. */
export const fetchSiteHierarchy = async (site: string): Promise<{params?: NodeParamType[]} | null> => {
  const res = await fetch(`/api/device/hierarchy?site=${encodeURIComponent(site)}`);
  if (!res.ok) return null;
  return res.json();
};

export const fetchDeviceTemplates = async (): Promise<DeviceTemplateList> => {
  const res = await fetch('/api/device/template');
  return parseOk<DeviceTemplateList>(res, 'Не удалось загрузить шаблоны устройств');
};

/** Возвращает ключи, которые удалось заблокировать (чужие блокировки не попадут). */
export const lockDevices = async (keys: string[]): Promise<string[]> => {
  const res = await fetch(`api/lock/`, {
    method: 'POST',
    body: JSON.stringify(keys),
  });
  return parseOk<string[]>(res, 'Не удалось начать редактирование');
};

/** Возвращает ключи, с которых блокировка снята. */
export const unlockDevices = async (keys: string[]): Promise<string[]> => {
  const res = await fetch(`api/unlock/`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(keys),
  });
  return parseOk<string[]>(res, 'Не удалось снять блокировку');
};

export const createDeviceRequest = async (node: {type: number; idNode: string; parentKey: string}) => {
  const res = await fetch('/api/device/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(node),
  });
  return parseOk<{nodeDTO: NodeType; params: NodeParamType[]}>(res, 'Не удалось создать узел');
};

export const deleteDeviceRequest = async (key: string) => {
  const res = await fetch(`/api/device/${key}`, {
    method: 'DELETE',
    headers: {'Content-Type': 'application/json'},
  });
  await parseOk(res, 'Не удалось удалить узел');
};

export const deleteImportedProjectRequest = async (site: string, project: string) => {
  const res = await fetch(
    `/api/device/import/${encodeURIComponent(site)}/${encodeURIComponent(project)}`,
    {method: 'DELETE'},
  );
  if (!res.ok) {
    // 409 — проект создан не импортом, 404 — его уже нет. Текст бэкенда объясняет
    // причину точнее любого нашего.
    const body = await res.json().catch(() => null);
    throw new Error(errorTextFromJson(res.status, body, `Не удалось удалить проект (${res.status})`));
  }
};

/** Удаление параметра с проверкой ответа (пункт меню «Удалить»). */
export const deleteParamRequest = async (key: string) => {
  const res = await fetch(`/api/device/param/${key}`, {
    method: 'DELETE',
    headers: {'Content-Type': 'application/json'},
  });
  await parseOk(res, 'Не удалось удалить параметр');
};

/** Удаление параметра без разбора ответа — так его исторически удаляет панель параметров. */
export const deleteParamUnchecked = async (key: string) => {
  await fetch(`/api/device/param/${key}`, {
    method: 'DELETE',
    headers: {'Content-Type': 'application/json'},
  });
};

export const createParamRequest = async (param: { id: number; value: string; parentKey: string }) => {
  const res = await fetch('/api/device/param/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(param),
  });
  return parseOk<NodeParamType>(res, 'Не удалось добавить параметр');
};

/** Сохраняет значения параметров; ответ — `{value: [{key, value}, …]}`. */
export const patchParamsRequest = async (changes: { key: string; value: string }[]) => {
  const res = await fetch('/api/device/param', {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({value: changes}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(errorTextFromJson(res.status, error, 'Ошибка сохранения параметров'));
  }

  return res.json(); // ожидаем { value: [ { key, value }, ... ] }
};
