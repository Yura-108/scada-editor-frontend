/**
 * Запись значений тегов в ПЛК из монитора («Опции» компонента).
 *
 * Формы запроса и ответа — из `docs/contract/2026-09-08-tag-write-contract.md` (бэкенд,
 * `TagWriteController` в `runtime`). Адрес тега — ПУТЬ КАНАЛА (`tagId` == `tag_id`
 * свойства): числовых идентификаторов в команде нет и не будет —
 * `docs/contract/TAG_CONTRACT_CHANGES.md`, принцип 1.
 */

/** Расширяемый список: неизвестный статус трактуем как отказ, а не роняем разбор. */
export type TagWriteStatus =
  | "APPLIED"
  // Локальные коды бэкенда, не шлюза: значение не привелось к `valueType` и ответ
  // шлюза не пришёл за отведённое время (применилась команда или нет — неизвестно).
  | "INVALID_VALUE"
  | "NO_CONFIRMATION"
  | "REJECTED_UNKNOWN_TAG"
  | "REJECTED_NOT_WRITABLE"
  | "REJECTED_TYPE_MISMATCH"
  | "REJECTED_PROTOCOL_UNSUPPORTED"
  | "FAILED_NO_CONNECTION"
  | "FAILED_WRITE"
  | string;

/** Одна запись: адрес тега и значение. */
export interface TagWriteItemDto {
  /** Полный путь канала — он же `tag_id` свойства компонента. */
  tagId: string;
  /** Значение как ввёл оператор; типизацию делает бэкенд по `valueType`. */
  value: string;
  /**
   * `value_type` свойства — `"boolean"`/`"integer"`/`"float"`/`"string"`/`"date"`, ровно те
   * значения, что предлагает форма свойства.
   *
   * По контракту поле необязательное, но слать его надо всегда, когда тип известен: без него
   * бэкенд отправляет значение строкой как есть, и на булевом теге это уезжает неверной
   * уставкой.
   */
  valueType?: string;
}

/**
 * Тело запроса: всегда МАССИВ записей, даже когда оператор жмёт «Записать в ПЛК» у одной
 * строки — тогда в `writes` один элемент.
 *
 * Одна форма на оба случая избавляет от развилки на всех трёх уровнях (окно → BFF → бэкенд):
 * «Применить для всех» иначе была бы либо вторым эндпоинтом, либо циклом одиночных запросов,
 * где половина значений могла бы уехать, а половина нет — и оператор не увидел бы, где именно
 * оборвалось. Метаданные сессии лежат в корне и не дублируются по строкам.
 *
 * Рецепт этим путём НЕ применяется: он стал процедурой из шагов, и записью тегов внутри
 * шага занимается рантайм (`/api/runtime/recipes/{id}/start` и далее). Здесь — только
 * точечная запись из «Опций» компонента.
 */
export interface TagWriteRequestDto {
  writes: TagWriteItemDto[];
  /**
   * Сессия и проект нужны бэкенду только для контекста и логов: запись НЕ привязана к
   * состоянию сессии мониторинга, тег адресуется напрямую по `tagId`.
   */
  sessionId?: string;
  projectId: number | null;
}

export interface TagWriteResultDto {
  /** Дублирует `tagId` запроса — для удобства чтения, а не для поиска (см. ниже). */
  tagId: string;
  status: TagWriteStatus;
  success: boolean;
  /** Пояснение от шлюза — показываем оператору как есть. */
  message?: string;
}

/** Подписи статусов для оператора. Неизвестный статус показываем самим кодом. */
export const TAG_WRITE_STATUS_LABELS: Record<string, string> = {
  APPLIED: "Записано",
  REJECTED_UNKNOWN_TAG: "Тег не найден на шлюзе",
  REJECTED_NOT_WRITABLE: "Тег доступен только для чтения",
  REJECTED_TYPE_MISMATCH: "Значение не подходит по типу",
  REJECTED_PROTOCOL_UNSUPPORTED: "Протокол не поддерживает запись",
  FAILED_NO_CONNECTION: "Нет связи с контроллером",
  FAILED_WRITE: "Ошибка записи",
  INVALID_VALUE: "Значение не подходит по типу",
  NO_CONFIRMATION: "Ответ шлюза не получен",
  // Локальные статусы CommandProducer: до шлюза команда не дошла вовсе.
  NOT_DELIVERED: "Брокер не принял команду",
  NO_TAG: "Тег не указан",
};

export const tagWriteStatusLabel = (result: TagWriteResultDto): string =>
  TAG_WRITE_STATUS_LABELS[result.status] ?? result.status;

/**
 * Исход записи с точки зрения оператора — ТРИ, а не два.
 *
 * `NO_CONFIRMATION` приходит с `success: false`, но означает не отказ, а НЕЗНАНИЕ: команда
 * ушла в брокер, ответ шлюза не пришёл к сроку, и она вполне могла примениться
 * (`CommandOutcome` на бэкенде документирует это прямым текстом и запрещает показывать её
 * как отказ). Показав «ошибку», мы заставляли бы оператора переписывать уже применённую
 * уставку; статус не редкий — он выдаётся при любом молчании шлюза дольше ~7 с.
 *
 * Значение такой строки на схему НЕ выводим: мнемосхема не должна уверенно показывать то,
 * чего в контроллере может не быть. Правду покажет ближайший кадр телеметрии.
 */
export type TagWriteOutcome = "applied" | "unknown" | "failed";

export const tagWriteOutcome = (result: TagWriteResultDto): TagWriteOutcome =>
  result.success ? "applied"
    : result.status === "NO_CONFIRMATION" ? "unknown"
    : "failed";

/**
 * Ответ — массив отчётов того же размера и порядка, что `writes`.
 *
 * Сопоставлять с запросом надо ПО ИНДЕКСУ: `tagId` в ответе дублируется для удобства, но
 * поиском по нему пользоваться нельзя — один и тот же тег может встретиться в `writes`
 * дважды, и обе строки нашли бы первый отчёт.
 *
 * Разбор терпимый намеренно: эндпоинт новый, и на несогласованной выкатке ответ может прийти
 * одиночным объектом. Уронить на этом окно оператора хуже, чем принять обе формы.
 */
export const normalizeTagWriteResults = (data: unknown): TagWriteResultDto[] => {
  if (Array.isArray(data)) return data as TagWriteResultDto[];
  if (data && typeof data === "object") {
    const results = (data as {results?: unknown}).results;
    if (Array.isArray(results)) return results as TagWriteResultDto[];
    // Одиночный отчёт: у него есть `status` — по нему и опознаём.
    if (typeof (data as TagWriteResultDto).status === "string") return [data as TagWriteResultDto];
  }
  return [];
};
