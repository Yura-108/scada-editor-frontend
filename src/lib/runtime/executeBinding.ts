import type {TagBinding} from "@/types/binding.types";
import {modernizeScopeCode, type TagScope} from "@/lib/runtime/bindingScope";

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
  /** tag_id-ы, изменение которых запускает биндинг (triggers либо весь тег-скоуп). */
  triggerTagIds: string[];
  /** propertyId-ы свойств-ссылок: их изменение (properties[]) также запускает биндинг. */
  triggerPropertyIds: number[];
  fn: (...args: unknown[]) => unknown;
}

/**
 * Значение в скоупе кода: переменная — это САМО значение (`Test > 100`), число, если
 * строка парсится как число, иначе сама строка.
 *
 * Обёртки `{V, RAW}` здесь больше нет: обращение через точку читалось как часть пути
 * тега (`ST.V` выглядело адресом канала, хотя `ST` — имя свойства элемента). Исходная
 * строка осталась доступна отдельным объектом `RAW` (см. buildRawScope), а старый код
 * переводится на новый синтаксис в compileBinding (modernizeScopeCode).
 *
 * `raw` может быть `null` (тег с quality != GOOD без последнего достоверного значения,
 * см. docs/contract/TAG_CONTRACT_CHANGES.md A3/B4) — важно не звать `.trim()` на нём.
 */
export const toScopeValue = (raw: string | null | undefined): number | string | null => {
  const num = raw != null && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isFinite(num) ? num : (raw ?? null);
};

/** Объект `RAW` в скоупе: исходные строки значений по имени переменной. */
export const buildRawScope = (
  names: readonly string[],
  rawOf: (name: string) => string | null | undefined,
): Record<string, string | null> => {
  const raw: Record<string, string | null> = {};
  for (const name of names) raw[name] = rawOf(name) ?? null;
  return raw;
};

/** Компилирует биндинг; ошибка синтаксиса возвращается строкой, не бросается. */
export const compileBinding = (
  elementKey: string,
  binding: TagBinding,
  scope: TagScope,
): CompiledBinding | {error: string} => {
  try {
    // Код старых схем («Имя.V») переводим на новый синтаксис перед компиляцией: иначе
    // `.V` на числе даст undefined и условие тихо перестанет выполняться.
    const code = modernizeScopeCode(binding.code, scope.names);
    const fn = new Function(...scope.names, "RAW", "setState", "setProp", "self", code) as
      (...args: unknown[]) => unknown;

    const scopeTagIds = scope.names
      .map(n => scope.tagIdByName[n])
      .filter((t): t is string => typeof t === "string");
    const triggerTagIds = binding.triggers?.length
      ? binding.triggers.filter(t => scopeTagIds.includes(t))
      : scopeTagIds;
    // Свойства-ссылки триггерят биндинг всегда (сужения по triggers пока нет).
    const triggerPropertyIds = Object.values(scope.propertyIdByName);

    return {elementKey, binding, scope, triggerTagIds, triggerPropertyIds, fn};
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }
};

export type ExecuteResult =
  | {intents: BindingIntent[]}
  | {error: string};

/**
 * Исполняет скомпилированный биндинг над текущими значениями тегов и свойств.
 * Значения тегов берутся из `valuesByTagId` (ключ — tag_id), значения свойств
 * других компонентов — из `valuesByPropertyId` (ключ — propertyId). Интенты
 * собираются коллекторами; «последний вызов выигрывает» по цели (одно состояние
 * на элемент, одно значение на свойство).
 */
export const executeBinding = (
  cb: CompiledBinding,
  valuesByTagId: ReadonlyMap<string, string | null>,
  valuesByPropertyId: ReadonlyMap<number, string>,
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

  const rawOf = (name: string): string | null | undefined =>
    name in cb.scope.tagIdByName
      ? valuesByTagId.get(cb.scope.tagIdByName[name])
      : valuesByPropertyId.get(cb.scope.propertyIdByName[name]);

  const args = cb.scope.names.map(name => toScopeValue(rawOf(name)));

  try {
    cb.fn(...args, buildRawScope(cb.scope.names, rawOf), setState, setProp, self ?? null);
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }

  const intents: BindingIntent[] = [...propIntents.values()];
  if (stateIntent) intents.push(stateIntent);
  return {intents};
};
