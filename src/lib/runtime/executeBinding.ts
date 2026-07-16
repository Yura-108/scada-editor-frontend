import type {TagBinding} from "@/types/binding.types";
import type {TagScope} from "@/lib/runtime/bindingScope";

/**
 * Компиляция и исполнение биндингов — чистый модуль без зависимостей от стора
 * (тестируется headless в Node; переиспользуется тест-прогоном в UI «Привязки»).
 *
 * Код биндинга компилируется ОДИН раз на загрузку сцены (new Function), на
 * горячем пути — только вызов готовой функции. Скрипт не имеет доступа к стору:
 * setState/setProp — коллекторы, которые лишь копят интенты; применяет их движок
 * одним applyRuntimeBatch. new Function — НЕ песочница (авторы биндингов — те же
 * доверенные инженеры, что пишут Java-скрипты); изоляция сбоев — try/catch на
 * каждый вызов + автоотключение после серии ошибок (см. useRuntimeEngine).
 */

export type BindingIntent =
  | {kind: "state"; stateName: string}
  | {kind: "prop"; key: string; value: unknown};

export interface CompiledBinding {
  elementKey: string;
  binding: TagBinding;
  scope: TagScope;
  /** tag_id-ы, изменение которых запускает биндинг (triggers либо весь скоуп). */
  triggerTagIds: string[];
  fn: (...args: unknown[]) => unknown;
}

/** Значение тега в скоупе кода: `Test.V` — число, если парсится, `Test.RAW` — сырая строка. */
export const buildTagObject = (raw: string | undefined) => {
  const num = raw !== undefined && raw.trim() !== "" ? Number(raw) : NaN;
  return {
    V: Number.isFinite(num) ? num : (raw ?? null),
    RAW: raw ?? null,
  };
};

/** Компилирует биндинг; ошибка синтаксиса возвращается строкой, не бросается. */
export const compileBinding = (
  elementKey: string,
  binding: TagBinding,
  scope: TagScope,
): CompiledBinding | {error: string} => {
  try {
    const fn = new Function(...scope.names, "setState", "setProp", "self", binding.code) as
      (...args: unknown[]) => unknown;

    const scopeTagIds = scope.names.map(n => scope.tagIdByName[n]);
    const triggerTagIds = binding.triggers?.length
      ? binding.triggers.filter(t => scopeTagIds.includes(t))
      : scopeTagIds;

    return {elementKey, binding, scope, triggerTagIds, fn};
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }
};

export type ExecuteResult =
  | {intents: BindingIntent[]}
  | {error: string};

/**
 * Исполняет скомпилированный биндинг над текущими значениями тегов.
 * Интенты собираются коллекторами; «последний вызов выигрывает» по цели
 * (одно состояние на элемент, одно значение на свойство).
 */
export const executeBinding = (
  cb: CompiledBinding,
  valuesByTagId: ReadonlyMap<string, string>,
  self?: unknown,
): ExecuteResult => {
  let stateIntent: {kind: "state"; stateName: string} | null = null;
  const propIntents = new Map<string, {kind: "prop"; key: string; value: unknown}>();

  const setState = (stateName: unknown) => {
    if (typeof stateName === "string" && stateName) {
      stateIntent = {kind: "state", stateName};
    }
  };
  const setProp = (key: unknown, value: unknown) => {
    if (typeof key === "string" && key) {
      propIntents.set(key, {kind: "prop", key, value});
    }
  };

  const args = cb.scope.names.map(name =>
    buildTagObject(valuesByTagId.get(cb.scope.tagIdByName[name])),
  );

  try {
    cb.fn(...args, setState, setProp, self ?? null);
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }

  const intents: BindingIntent[] = [...propIntents.values()];
  if (stateIntent) intents.push(stateIntent);
  return {intents};
};
