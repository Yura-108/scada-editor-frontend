import type {NodeParamType} from "@/types/channelsTypes";
import {isParamChecked} from "@/lib/paramWidget";

/**
 * Данные тега из базы каналов, нужные для строки таблицы-рецепта.
 *
 * У самого узла дерева нет ничего, кроме пути (`key`): описание и признак строкового
 * значения лежат отдельными строками `useDeviceStore.params` — по одной на параметр,
 * адресованных `parentKey` (= ключ узла) и `name` (= имя из справочника
 * `channel.description`, приезжает уже расшифрованным в `ParamDto.name`).
 *
 * Функции берут `params` аргументом, а не читают стор: их зовут и из модалки, и из
 * действия стора, а чистые они заодно проверяемы.
 */

/** Имя параметра «описание» в справочнике базы каналов. */
const DESCRIPTION_PARAM = "описание";

/** Имя параметра «значение — строка», по нему угадывается value_type свойства. */
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
 * Тип значения свойства по параметру «Строковый (IsString)» (0/1).
 *
 * Пустым результат быть не может: `invalidProperties` роняет сохранение ВСЕЙ сцены,
 * если у свойства не заполнен `value_type`. Параметра нет — считаем числом: подавляющее
 * большинство уставок числовые, а тип всегда можно поправить в карточке свойства.
 */
export function tagValueType(params: NodeParamType[], tagKey: string): string {
  // Имя в справочнике — «Строковый (IsString)»; сверяем по латинской части, она
  // стабильнее русской подписи, которую в справочнике можно переименовать.
  const param = paramOf(params, tagKey, name => name.includes(IS_STRING_PARAM));
  return param && isParamChecked(param.value) ? "string" : "float";
}

/** Последний сегмент пути тега — короткое имя канала. */
export function shortTagName(tagKey: string): string {
  const parts = tagKey.split(".");
  return parts[parts.length - 1] || tagKey;
}

/** Строка будущей таблицы-рецепта: одно свойство-тег со всем, что о нём известно. */
export interface RecipeTableRow {
  /** Полный путь тега — он же `tag_id` свойства. */
  tagId: string;
  /** Имя свойства: короткое имя тега, уникализованное в пределах таблицы. */
  name: string;
  description: string;
  valueType: string;
}

/**
 * Собирает строки таблицы по выбранным в дереве тегам.
 *
 * Имя свойства обязано быть уникальным внутри компонента: по имени его сопоставляет
 * бэкенд (когда номера ещё нет), по имени к нему привязываются ячейки таблицы и значения
 * рецепта. Короткие имена каналов у разных устройств совпадают сплошь и рядом, поэтому
 * дубли разводим суффиксом `_2`, `_3`… — полный путь при этом остаётся в `tag_id`,
 * так что привязка к тегу не страдает.
 */
export function buildRecipeTableRows(
  tagKeys: string[],
  params: NodeParamType[],
): RecipeTableRow[] {
  const used = new Set<string>();

  return tagKeys.map(tagId => {
    const base = shortTagName(tagId);
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}_${i}`;
    used.add(name);

    return {
      tagId,
      name,
      description: tagDescription(params, tagId),
      valueType: tagValueType(params, tagId),
    };
  });
}
