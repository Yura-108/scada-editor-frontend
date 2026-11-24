/** Коды закрытия WS, введённые правами доступа. */
const CLOSE_ACCESS_REVOKED = 4403;
const CLOSE_POLICY_VIOLATION = 1008;
/** Try Again Later: сервер после рестарта ещё не загрузил права — это не отказ. */
const CLOSE_TRY_AGAIN_LATER = 1013;

/**
 * Что делать после закрытия сокета:
 * - `rejected` — окончательный отказ, реконнект не запускать;
 * - `revoked` — права отозваны, реконнект не запускать, монитор уведёт к выбору проекта;
 * - `retry-later` — сервер ещё грузит права, переподключиться с паузой;
 * - `reconnect` — обычное переподключение через новую сессию.
 */
export type CloseOutcome =
  | {kind: "rejected"; detail: string}
  | {kind: "revoked"}
  | {kind: "retry-later"}
  | {kind: "reconnect"};

export function classifyClose(code: number, reason: string): CloseOutcome {
  // 1003 — окончательный отказ (у сессии уже есть живое соединение, либо она
  // неизвестна/закрыта): реконнект-цикл тут будет крутиться вечно без толку.
  // 1008 — подключение к чужой сессии: тоже окончательно.
  if (code === 1003 || code === CLOSE_POLICY_VIOLATION) {
    return {kind: "rejected", detail: code === CLOSE_POLICY_VIOLATION ? "Сессия принадлежит другому пользователю" : reason};
  }

  // 4403 — права в проекте отозваны (или учётка отключена). Переподключение лишь
  // получило бы тот же отказ; монитор сам уведёт к выбору проекта.
  if (code === CLOSE_ACCESS_REVOKED) return {kind: "revoked"};

  // 1013 — сервер после рестарта ещё не загрузил права: обычный реконнект, но с паузой.
  if (code === CLOSE_TRY_AGAIN_LATER) return {kind: "retry-later"};

  return {kind: "reconnect"};
}
