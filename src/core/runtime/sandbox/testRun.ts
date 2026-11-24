import {createScriptSandbox, SANDBOX_TIMEOUTS, SandboxTimeoutError, type ScriptSandbox} from "./scriptSandbox";
import type {SandboxValues} from "./protocol";

/**
 * Песочница для тест-прогонов в редакторе («Тест» в окнах привязки и скрипта события).
 *
 * Одна на вкладку и поднимается при первом прогоне: воркер стоит недорого, а держать его
 * с открытия редактора незачем. Не закрывается — следующий прогон, возможно, через минуту.
 */
let instance: ScriptSandbox | null = null;

export const editorTestSandbox = (): ScriptSandbox => (instance ??= createScriptSandbox());

/** Значения для песочницы из карт тест-прогона (`useScriptDraft.mockMaps`). */
export const toSandboxValues = (
  tags: ReadonlyMap<string, string | null>,
  props: ReadonlyMap<number, string>,
): SandboxValues => ({tags: [...tags], props: [...props]});

/** Текст для окна, когда до результата прогона не дошло: зависание или сбой песочницы. */
export const describeSandboxFailure = (err: unknown): string =>
  err instanceof SandboxTimeoutError
    ? `Скрипт не ответил за ${SANDBOX_TIMEOUTS.test / 1000} с и остановлен — проверьте циклы`
    : `Песочница скриптов: ${err instanceof Error ? err.message : String(err)}`;
