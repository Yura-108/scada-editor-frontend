import type {NodeParamType} from "@/types/channelsTypes";
import type {RecipeTag, RecipeValueType} from "@/types/recipe.types";
import {isParamChecked} from "@/lib/paramWidget";

/**
 * Данные тега из базы каналов — то, чем заполняется манифест рецепта (`tags[]`).
 *
 * У узла дерева нет ничего, кроме пути (`key`): описание и признак строкового значения
 * лежат отдельными строками `useDeviceStore.params`, адресованными `parentKey` (= ключ узла)
 * и `name` (имя из справочника `channel.description`, приезжает уже расшифрованным).
 *
 * Функции берут `params` аргументом, а не читают стор: их зовут и из модалки, и из сборки
 * таблицы, а чистые они заодно проверяемы headless.
 */

/** Имя параметра «описание» в справочнике базы каналов. */
const DESCRIPTION_PARAM = "описание";

/** Имя параметра «значение — строка», по нему угадывается тип. */
const IS_STRING_PARAM = "isstring";

const normalizeName = (name: string | null | undefined): string =>
  (name ?? "").trim().toLowerCase();

const paramOf = (
  params: NodeParamType[],
  tagKey: string,
  matches: (name: string) => boolean,
): NodeParamType | undefined =>
  params.find(p => p.parentKey === tagKey && matches(normalizeName(p.name)));

/** Описание тега целиком; пусто, если параметра нет. */
export function tagDescription(params: NodeParamType[], tagKey: string): string {
  return paramOf(params, tagKey, name => name === DESCRIPTION_PARAM)?.value?.trim() ?? "";
}

/**
 * Тип значения тега в СЛОВАРЕ КОНТРАКТА (`number` / `bool` / `string`).
 *
 * Словарь важен: `RecipeServiceImpl.requireTypeMatch` разбирает ровно эти три значения,
 * а всё прочее попадает в `default -> true` и проверку молча ОТКЛЮЧАЕТ. Прислать сюда
 * «float» из внутренней терминологии базы каналов — значит остаться без валидации.
 *
 * **`bool` по базе каналов не определяется вовсе**: там есть только «Строковый (IsString)»,
 * отдельного признака дискретного тега нет. Поэтому логический тег пользователь помечает
 * руками — иначе бэкенд отобьёт `true` при объявленном `number`.
 */
export function tagValueType(params: NodeParamType[], tagKey: string): RecipeValueType {
  const param = paramOf(params, tagKey, name => name.includes(IS_STRING_PARAM));
  return param && isParamChecked(param.value) ? "string" : "number";
}

/** Последний сегмент пути тега — короткое имя канала. */
export function shortTagName(tagKey: string): string {
  const parts = tagKey.split(".");
  return parts[parts.length - 1] || tagKey;
}

/**
 * Собирает манифест по выбранным в дереве тегам.
 *
 * `name` — короткое имя, которым на тег ссылаются шаги (`action[].tag`), поэтому оно обязано
 * быть уникальным внутри рецепта: одинаковые имена каналов у разных устройств встречаются
 * сплошь и рядом, дубли разводим суффиксом `_2`, `_3`… Полный путь при этом остаётся в `tag`,
 * так что адресация не страдает.
 *
 * `taken` позволяет дозаполнять уже существующий манифест, не сталкиваясь с его именами.
 */
export function buildManifestTags(
  tagKeys: string[],
  params: NodeParamType[],
  taken: Iterable<string> = [],
): RecipeTag[] {
  const used = new Set<string>(taken);

  return tagKeys.map(tag => {
    const base = shortTagName(tag);
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}_${i}`;
    used.add(name);

    return {
      name,
      tag,
      value_type: tagValueType(params, tag),
      description: tagDescription(params, tag),
    };
  });
}
