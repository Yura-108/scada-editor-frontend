/**
 * Запись значения одного тега в ПЛК из монитора.
 *
 * Форма ответа взята из контракта команд (`docs/contract/TAG_CONTRACT_CHANGES.md`, A5):
 * шлюз отвечает на команду отчётом с `commandId`, именем тега и статусом. Адрес тега —
 * ПУТЬ КАНАЛА (`tagName` == `tag_id` свойства): числовых идентификаторов в команде нет
 * и не будет — это первый принцип того же документа.
 */

/** Расширяемый список: неизвестный статус трактуем как отказ, а не роняем разбор. */
export type TagWriteStatus =
  | "APPLIED"
  | "REJECTED_UNKNOWN_TAG"
  | "REJECTED_NOT_WRITABLE"
  | "REJECTED_TYPE_MISMATCH"
  | "REJECTED_PROTOCOL_UNSUPPORTED"
  | "FAILED_NO_CONNECTION"
  | "FAILED_WRITE"
  | string;

export interface TagWriteRequestDto {
  /** Полный путь канала — он же `tag_id` свойства компонента. */
  tagId: string;
  /** Значение как ввёл оператор; типизацию делает бэкенд по типу канала. */
  value: string;
  sessionId: string;
  projectId: number | null;
}

export interface TagWriteResultDto {
  commandId: string;
  tagName: string;
  status: TagWriteStatus;
  success: boolean;
  /** Пояснение от шлюза — показываем оператору как есть. */
  message?: string;
  appliedValue?: unknown;
  timestamp?: string;
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
};

export const tagWriteStatusLabel = (result: TagWriteResultDto): string =>
  TAG_WRITE_STATUS_LABELS[result.status] ?? result.status;
