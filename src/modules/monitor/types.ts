/**
 * Аварии и сообщения ПЛК (контракт docs/contract/2026-10-26-pac-alarms-frontend-contract.md).
 */

/**
 * `ALARM` — активна; `RETURN` — причина ушла, ждёт подтверждения; `ACCEPT` — подтверждена,
 * причина ещё есть (у ошибок устройств).
 */
export type AlarmState = "ALARM" | "RETURN" | "ACCEPT";

/** Активная авария проекта: приходит в `SNAPSHOT.alarms` и `UPDATE.alarms`. */
export interface ActiveAlarm {
  /** Идентификатор в пределах контроллера; передаётся в `ack`. */
  key: string;
  controllerId: string;
  objectType: number;
  objectNumber: number;
  alarmNumber: number;
  /** Текст для оператора — показывать как есть. */
  description: string;
  /** «тревога», «сообщение», «ответ»; у критических ошибок PAC может быть другая строка. */
  group: string;
  /** Меньше — важнее: 0 фатальная, 100 связь, 250 тревога, 500 сообщение, 750 ответ, 1000 напоминание. */
  priority: number;
  state: AlarmState | string;
  /** Подавлена в ПЛК — пока только пометка. */
  suppressed: boolean;
  /** Мс epoch: когда авария появилась. */
  since: number;
  /** Можно подтвердить (`false` у `ACCEPT` и у критических ошибок PAC). */
  ackable: boolean;
  /** Связь шлюза с ПЛК потеряна — список может быть устаревшим. */
  stale: boolean;
}

/** Ссылка на аварию в запросе квитирования. */
export interface AlarmRef {
  controllerId: string;
  key: string;
}

/** Исход квитирования одной аварии. `APPLIED`/`NOT_FOUND`/`NOT_ACKABLE` — не ошибка. */
export interface AlarmAckResult extends AlarmRef {
  outcome: string;
  message?: string | null;
}

