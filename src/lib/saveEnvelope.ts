/**
 * Конверт сохранения сцены (§1 контракта версий) — тело `PUT /api/editor/components`.
 *
 * Форма фиксирована: бэкенд принимает объект `ComponentSaveRequestDto`
 * `{components, scene_id, based_on_version, save_kind}` и ничего кроме него. Голый
 * массив компонентов (старый контракт) больше не поддерживается ни здесь, ни на
 * бэкенде — переходный флаг `EDITOR_SAVE_ENVELOPE`, который переключал форму тела и
 * метод, убран вместе со старой веткой.
 */

export type SaveEnvelope = {
  components: unknown[];
  based_on_version?: number | null;
  save_kind?: string;
  /**
   * Сцена, состав которой описывает тело. Обязателен: тело читается как «вот состав
   * сцены целиком», и компонента, которого в нём нет, сервер удаляет.
   */
  scene_id?: number;
};

/** Тело запроса, если это конверт; иначе `null` (вызывающий отвечает 400). */
export const toSaveEnvelope = (body: unknown): SaveEnvelope | null =>
  body && typeof body === "object" && Array.isArray((body as SaveEnvelope).components)
    ? (body as SaveEnvelope)
    : null;

/**
 * Приводит ответ сохранения к `{components, version_no}`.
 *
 * Массив вместо объекта означает ответ по старому контракту. Разбираем и его — не ради
 * совместимости, а потому что цена ошибки несимметрична: `components: []` подставится
 * в холст и сотрёт сцену. Лучше принять неожиданную форму, чем обнулить работу.
 */
export const normalizeSaveResponse = (data: unknown): Record<string, unknown> => {
  if (Array.isArray(data)) return {components: data, version_no: null};

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    return {
      ...obj,
      components: Array.isArray(obj.components) ? obj.components : [],
      version_no: typeof obj.version_no === "number" ? obj.version_no : null,
    };
  }

  return {components: [], version_no: null};
};
