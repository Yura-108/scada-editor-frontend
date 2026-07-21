import type {ElementEventHandler} from "@/types/binding.types";
import type {TagScope} from "@/lib/runtime/bindingScope";
import {buildTagObject, type BindingIntent} from "@/lib/runtime/executeBinding";

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
      "setProperty",
      "setProp",
      "setState",
      "self",
      handler.code,
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
 */
export const executeEventScript = (
  cb: CompiledEventScript,
  valuesByTagId: ReadonlyMap<string, string>,
  valuesByPropertyId: ReadonlyMap<number, string>,
  self?: unknown,
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

  const args = cb.scope.names.map(name => {
    if (name in cb.scope.tagIdByName) {
      return buildTagObject(valuesByTagId.get(cb.scope.tagIdByName[name]));
    }
    return buildTagObject(valuesByPropertyId.get(cb.scope.propertyIdByName[name]));
  });

  try {
    cb.fn(...args, setProperty, setProp, setState, self ?? null);
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }

  const intents: BindingIntent[] = [...propIntents.values()];
  if (stateIntent) intents.push(stateIntent);
  return {writes: [...writes.values()], intents};
};
