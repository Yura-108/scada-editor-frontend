import type {ElementEventHandler} from "@/types/binding.types";
import {modernizeScopeCode, type TagScope} from "@/lib/runtime/bindingScope";
import {buildRawScope, toScopeValue, type BindingIntent} from "@/lib/runtime/executeBinding";

/**
 * Компиляция и исполнение обработчиков событий (onClick/onDoubleClick) — чистый
 * модуль без зависимостей от стора (тестируется headless; переиспользуется
 * тест-прогоном в редакторе события).
 *
 * Отличие от биндингов: обработчик запускается по КЛИКУ (а не по изменению
 * значения) и умеет ПИСАТЬ значения свойств через `setProperty("Имя", значение)`
 * (запись уходит в тот же буфер, что и серверные properties[] — на неё реагируют
 * биндинги других элементов). `setProp`/`setState` меняют сам элемент.
 */

/** Запись значения в свойство объекта (ключ маршрутизации — propertyId). */
export interface PropertyWrite {
  propertyId: number;
  value: string;
}

export interface CompiledEventScript {
  elementKey: string;
  scope: TagScope;
  fn: (...args: unknown[]) => unknown;
}

export type EventExecResult =
  | {writes: PropertyWrite[]; intents: BindingIntent[]}
  | {error: string};

/** Компилирует обработчик; ошибка синтаксиса возвращается строкой, не бросается. */
export const compileEventScript = (
  elementKey: string,
  handler: ElementEventHandler,
  scope: TagScope,
): CompiledEventScript | {error: string} => {
  try {
    const fn = new Function(
      ...scope.names,
      "RAW",
      "setProperty",
      "setProp",
      "setState",
      "self",
      "runScript",
      // Старый синтаксис «Имя.V» переводим на новый — см. modernizeScopeCode.
      modernizeScopeCode(handler.code, scope.names),
    ) as (...args: unknown[]) => unknown;
    return {elementKey, scope, fn};
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }
};

/**
 * Исполняет скомпилированный обработчик над текущими значениями тегов/свойств.
 * Возвращает записи в свойства (для маршрутизации на биндинги) и интенты
 * setProp/setState на сам элемент. «Последний вызов выигрывает» по цели.
 *
 * `runScript(name)` — мост к серверному Java-скрипту (запись тега в ПЛК): в мониторе
 * колбэк шлёт ACTION по WS; в тест-прогоне редактора параметр не передаётся (no-op).
 */
export const executeEventScript = (
  cb: CompiledEventScript,
  valuesByTagId: ReadonlyMap<string, string | null>,
  valuesByPropertyId: ReadonlyMap<number, string>,
  self?: unknown,
  runScript?: (name: string) => void,
): EventExecResult => {
  const writes = new Map<number, PropertyWrite>();
  let stateIntent: {kind: "state"; stateName: string} | null = null;
  const propIntents = new Map<string, {kind: "prop"; key: string; value: unknown}>();

  // Запись значения в свойство по ИМЕНИ переменной скоупа (property ref).
  const setProperty = (name: unknown, value: unknown) => {
    if (typeof name !== "string" || !(name in cb.scope.propertyIdByName)) return;
    const propertyId = cb.scope.propertyIdByName[name];
    writes.set(propertyId, {propertyId, value: value == null ? "" : String(value)});
  };
  const setProp = (key: unknown, value: unknown) => {
    if (typeof key === "string" && key) propIntents.set(key, {kind: "prop", key, value});
  };
  const setState = (stateName: unknown) => {
    if (typeof stateName === "string" && stateName) stateIntent = {kind: "state", stateName};
  };
  // Запуск серверного скрипта по имени — делегируем колбэку движка (шлёт ACTION по WS).
  const runScriptFn = (name: unknown) => {
    if (typeof name === "string" && name && runScript) runScript(name);
  };

  const rawOf = (name: string): string | null | undefined =>
    name in cb.scope.tagIdByName
      ? valuesByTagId.get(cb.scope.tagIdByName[name])
      : valuesByPropertyId.get(cb.scope.propertyIdByName[name]);

  const args = cb.scope.names.map(name => toScopeValue(rawOf(name)));

  try {
    cb.fn(
      ...args,
      buildRawScope(cb.scope.names, rawOf),
      setProperty,
      setProp,
      setState,
      self ?? null,
      runScriptFn,
    );
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }

  const intents: BindingIntent[] = [...propIntents.values()];
  if (stateIntent) intents.push(stateIntent);
  return {writes: [...writes.values()], intents};
};
