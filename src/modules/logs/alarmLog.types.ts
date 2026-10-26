/** Журнал аварий ПЛК (контракт docs/contract/2026-10-26-pac-alarms-frontend-contract.md, §4). */

export type AlarmLogEvent = "RAISED" | "ACCEPTED" | "RETURNED" | "CLEARED" | "SUPPRESSED" | "UNSUPPRESSED";

export interface AlarmLogRecord {
  /** ISO-8601. */
  ts: string;
  projectId: number;
  controllerId: string;
  key: string;
  objectType: number;
  objectNumber: number;
  alarmNumber: number;
  description: string;
  group: string;
  priority: number;
  event: AlarmLogEvent | string;
  /** Кто подтвердил через новый монитор; `null` — в другом месте (старый монитор) или ушла сама. */
  username: string | null;
}

/** Применённый фильтр: по нему идёт запрос. */
export interface AlarmLogFilter {
  /** Мс epoch. */
  from: number;
  to: number;
  projectId: number | null;
  group: string;
  event: AlarmLogEvent | "";
}
