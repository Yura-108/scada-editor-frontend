/**
 * Конверт сохранения (§1 контракта версий от 11.08.2026) и его совместимость.
 *
 * Смена формы тела — единственное ломающее изменение контракта: голый массив
 * компонентов перестаёт приниматься ровно в тот момент, когда начинает приниматься
 * объект `{components, based_on_version, save_kind}`.
 *
 * Чтобы это не требовало выкатки фронта и бэкенда с точностью до часа, разворот
 * конверта живёт ЗДЕСЬ, в BFF: клиент с первого дня говорит на новом контракте, а
 * прокси по переменной окружения решает, что именно уходит бэкенду. Переключение —
 * одна переменная и рестарт, откат мгновенный.
 *
 * По умолчанию ВЫКЛЮЧЕНО: пока бэкенд ждёт голый массив, ничего не меняется.
 */

/** Признак того, что бэкенд уже принимает конверт. Включается переменной окружения. */
export const saveEnvelopeEnabled = (): boolean => {
  const raw = (process.env.EDITOR_SAVE_ENVELOPE ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
};

export type SaveEnvelope = {
  components: unknown[];
  based_on_version?: number | null;
  save_kind?: string;
  /**
   * Сцена, состав которой описывает тело. Обязателен для `PUT` (без него бэкенд
   * отвечает 400) и не принимается `POST`. Тело `PUT` читается как «вот состав сцены
   * целиком»: компонента, которого в нём нет, сервер удаляет.
   */
  scene_id?: number;
};

/**
 * Приводит тело запроса к конверту.
 *
 * Голый массив тоже принимаем: так роут остаётся совместимым с любым старым
 * клиентом и с ручными запросами, а весь остальной код работает с одной формой.
 */
export const toSaveEnvelope = (body: unknown): SaveEnvelope | null => {
  if (Array.isArray(body)) return {components: body};

  if (body && typeof body === "object" && Array.isArray((body as SaveEnvelope).components)) {
    return body as SaveEnvelope;
  }

  return null;
};

/** Тело, которое реально уходит бэкенду: конверт целиком либо только массив. */
export const saveRequestBody = (envelope: SaveEnvelope): unknown =>
  saveEnvelopeEnabled() ? envelope : envelope.components;

/**
 * Метод и тело запроса к бэкенду.
 *
 * По новому контракту сохранение существующей сцены — это `PUT` с полным составом:
 * `POST` не принимает `scene_id` и ничего не удаляет. Старый бэкенд про `PUT` не знает
 * вовсе и ждёт `POST` с голым массивом, поэтому МЕТОД переключается тем же флагом, что
 * и форма тела: клиент всегда говорит на новом контракте, а разворот живёт здесь.
 */
export const saveBackendRequest = (
  envelope: SaveEnvelope,
): {method: "POST" | "PUT"; body: unknown} =>
  saveEnvelopeEnabled()
    ? {method: "PUT", body: envelope}
    : {method: "POST", body: envelope.components};

/**
 * Приводит ответ сохранения к `{components, version_no, merged?}`.
 *
 * Старый бэкенд отдаёт голый массив — подставляем `version_no: null`, и клиентский
 * код пишется ОДИН раз, без ветки «а вдруг это ещё массив».
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

/**
 * Поля версионирования для документов БЕЗ конверта (шаблоны — у них тело и так объект,
 * оборачивать нечего, поля добавляются рядом с существующими).
 *
 * Пока конверт выключен, поля вырезаются: старый бэкенд может не знать их вовсе.
 */
export const withVersionFields = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  if (saveEnvelopeEnabled()) return body;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {based_on_version: _base, save_kind: _kind, ...rest} = body;
  return rest;
};
