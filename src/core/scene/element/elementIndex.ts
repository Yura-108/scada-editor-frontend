import { DiagramElement } from "@/types/editorElement.type";

/**
 * Индексы плоского массива элементов.
 *
 * `elements` — плоский список, иерархия выражена ключами (`parentKey`). Почти вся
 * геометрия ходит по этой иерархии вверх (к родителю) и вниз (к детям), и без
 * индекса каждый шаг был линейным поиском: `getAbsoluteRenderedPosition` делал
 * `elements.find` на каждый уровень вложенности, а границы группы —
 * `elements.filter` на каждом уровне рекурсии. На схеме из сотен элементов один
 * запрос границ выходил в O(N × глубина).
 */
export interface ElementIndex {
  /** key → элемент. Совместим по форме с прежним `elementsMap` (доступ по индексу). */
  byKey: Record<string, DiagramElement>;
  /** Строковый серверный id → элемент. Часть кода ссылается на родителя по id. */
  byId: Record<string, DiagramElement>;
  /** parentKey → ключи прямых детей, в порядке исходного массива. */
  childKeysOf: Record<string, string[]>;
}

const emptyRecord = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;

export function buildElementIndex(elements: DiagramElement[]): ElementIndex {
  const byKey = emptyRecord<DiagramElement>();
  const byId = emptyRecord<DiagramElement>();
  const childKeysOf = emptyRecord<string[]>();

  for (const el of elements) {
    byKey[el.key] = el;
    if (el.id !== null && el.id !== undefined) byId[String(el.id)] = el;

    const parentKey = el.parentKey == null ? "" : String(el.parentKey);
    if (!parentKey) continue;
    (childKeysOf[parentKey] ??= []).push(el.key);
  }

  return { byKey, byId, childKeysOf };
}

/**
 * Индекс для конкретного массива, с кэшем по ссылке на массив.
 *
 * Любая правка схемы создаёт новый массив `elements` (на этом же построены
 * `equality` истории undo и флаг «есть несохранённые изменения»), поэтому
 * ссылка — корректный ключ кэша: пока массив тот же, индекс актуален.
 * WeakMap не удерживает старые версии массива в памяти.
 */
const indexCache = new WeakMap<DiagramElement[], ElementIndex>();

export function getElementIndex(elements: DiagramElement[]): ElementIndex {
  let index = indexCache.get(elements);
  if (!index) {
    index = buildElementIndex(elements);
    indexCache.set(elements, index);
  }
  return index;
}

/**
 * Родитель элемента: сначала по ключу, затем по серверному id.
 *
 * Поиск по id — не избыточность: у части элементов `parentKey` хранит именно id
 * (так приходят данные с бэкенда до полного разбора сцены), и прежний
 * `elements.find(e => e.key === parentKey || String(e.id) === String(parentKey))`
 * учитывал оба случая.
 */
export function resolveParentElement(
  parentKey: string | null | undefined,
  index: ElementIndex,
): DiagramElement | null {
  if (parentKey == null || parentKey === "") return null;
  return index.byKey[parentKey] ?? index.byId[String(parentKey)] ?? null;
}

/** Прямые дети по `parentKey` (то, что раньше давал `elements.filter`). */
export function getChildElements(key: string, index: ElementIndex): DiagramElement[] {
  const keys = index.childKeysOf[String(key)];
  if (!keys) return [];
  const result: DiagramElement[] = [];
  for (const k of keys) {
    const child = index.byKey[k];
    if (child) result.push(child);
  }
  return result;
}
