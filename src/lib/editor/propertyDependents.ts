import type {DiagramElement} from "@/types/editorElement.type";
import type {TagBinding} from "@/types/binding.types";

/**
 * Что в сцене ссылается на серверное свойство (`PropertyCreateDto.id`) и как это
 * починить при его удалении.
 *
 * Ссылок три вида, и каждая ломается по-своему:
 *
 * 1. `binding.componentPropertyId` — пара «биндинг ↔ свойство хозяина», которую отдал
 *    сервер. `buildComponentTree` шлёт сохранённый номер КАК ЕСТЬ, и после удаления
 *    свойства бэкенд отклоняет весь `PUT` сцены целиком (400 «does not belong to
 *    component X»). Лечение — снять пару: `encodeBindings` тогда пересчитает номер
 *    через `firstSavedPropertyId`.
 * 2. `binding.propertyRefs[].propertyId` / `event.handler.propertyRefs[]` — ссылки на
 *    свойства ЧУЖИХ компонентов. Живут в любом элементе сцены, поэтому обходим всё
 *    дерево, а не только хозяина. Висячий ref не ломает сохранение, но остаётся
 *    переменной, значение по которой не придёт никогда, — молча сломанная логика.
 * 3. Прямые привязки (`direct`, см. lib/runtime/directBinding.ts) состоят из ОДНОГО
 *    ref-а и кода `setProp(target, var.V)`. Снять у них ref нельзя — код останется
 *    ссылаться на несуществующую переменную и упадёт в рантайме; такие биндинги
 *    удаляются целиком.
 *
 * Модуль чистый (никаких зависимостей от стора) — прогоняется headless.
 */

/** Ссылается ли биндинг/обработчик на свойство через propertyRefs. */
const refsProperty = (refs: {propertyId: number}[] | undefined, propertyId: number): boolean =>
  Boolean(refs?.some(r => r.propertyId === propertyId));

/** Человекочитаемое имя элемента для текста подтверждения. */
const elementLabel = (el: DiagramElement): string =>
  el.label?.trim() || el.type || "элемент";

/** Человекочитаемое имя биндинга (у прямых привязок имя = имя свойства). */
const bindingLabel = (el: DiagramElement, b: TagBinding): string =>
  `${elementLabel(el)} · ${b.name?.trim() || "без названия"}`;

export interface PropertyDependents {
  /** Привязки, у которых снимется только ссылка на свойство (код остаётся). */
  bindings: string[];
  /** Прямые привязки, которые будут удалены целиком (без ref-а они нерабочие). */
  directBindings: string[];
  /** Обработчики событий, из которых уйдёт ссылка. */
  events: string[];
  /** У хозяина свойства есть биндинги, а других сохранённых свойств не останется. */
  leavesBindingsWithoutProperty: boolean;
}

/**
 * Кто в сцене пострадает от удаления свойства. Питает текст диалога подтверждения —
 * пользователь должен видеть цену действия до, а не после.
 *
 * `leavesBindingsWithoutProperty` — отдельный, самый неприятный случай: если у элемента
 * останутся биндинги, но ни одного сохранённого свойства, `firstSavedPropertyId` вернёт
 * 0, и сохранение сцены начнёт падать 400 целиком (см. предупреждение в
 * OpenBindingEditorModal). Это не повод запрещать удаление, но повод предупредить.
 */
export const collectPropertyDependents = (
  elements: DiagramElement[],
  propertyId: number,
  componentId: number,
): PropertyDependents => {
  const bindings: string[] = [];
  const directBindings: string[] = [];
  const events: string[] = [];
  let leavesBindingsWithoutProperty = false;

  for (const el of elements) {
    for (const b of el.bindings ?? []) {
      const byRef = refsProperty(b.propertyRefs, propertyId);
      const byOwner = el.id === componentId && b.componentPropertyId === propertyId;
      if (!byRef && !byOwner) continue;
      if (b.direct && byRef) directBindings.push(bindingLabel(el, b));
      else bindings.push(bindingLabel(el, b));
    }

    for (const e of el.events ?? []) {
      if (refsProperty(e.handler?.propertyRefs, propertyId)) {
        events.push(`${elementLabel(el)} · ${e.event_type}`);
      }
    }

    if (el.id === componentId && (el.bindings?.length || el.events?.length)) {
      const remaining = (el.properties ?? []).filter(
        p => p.id !== propertyId && typeof p.id === "number",
      );
      if (!remaining.length) leavesBindingsWithoutProperty = true;
    }
  }

  return {bindings, directBindings, events, leavesBindingsWithoutProperty};
};

/** Убирает из биндингов элемента всё, что ссылается на удалённое свойство. */
const purgeElementBindings = (
  el: DiagramElement,
  propertyId: number,
  isOwner: boolean,
): {bindings: TagBinding[]; changed: boolean} => {
  const source = el.bindings ?? [];
  let changed = false;
  const bindings: TagBinding[] = [];

  for (const b of source) {
    const byRef = refsProperty(b.propertyRefs, propertyId);

    // Прямая привязка без своего ref-а нерабочая — выбрасываем её, а не чиним.
    if (b.direct && byRef) {
      changed = true;
      continue;
    }

    let next = b;

    if (byRef) {
      next = {...next, propertyRefs: (next.propertyRefs ?? []).filter(r => r.propertyId !== propertyId)};
      changed = true;
    }

    // Пару «биндинг ↔ свойство» снимаем только у хозяина: у чужого элемента этот номер
    // адресует его собственное свойство, которое мы не трогали.
    if (isOwner && next.componentPropertyId === propertyId) {
      // Поля именно УДАЛЯЮТСЯ, а не зануляются: `encodeBindings` отличает «сервер пары не
      // присылал» (тогда номер считается через firstSavedPropertyId) только по отсутствию ключа.
      const rest = {...next};
      delete rest.componentPropertyId;
      delete rest.componentPropertyName;
      next = rest;
      changed = true;
    }

    bindings.push(next);
  }

  return {bindings, changed};
};

/**
 * Убирает свойство из элемента-хозяина и вычищает все ссылки на него по всей сцене.
 *
 * Возвращает ИСХОДНЫЙ массив, если ничего не изменилось: новая ссылка на `elements`
 * — это шаг в истории zundo (`equality` сравнивает массивы по ссылке), и пустая
 * мутация засорила бы Ctrl+Z.
 */
export const purgePropertyRefs = (
  elements: DiagramElement[],
  propertyId: number,
  componentId: number,
): DiagramElement[] => {
  let touched = false;

  const next = elements.map(el => {
    const isOwner = el.id === componentId;
    let changed = false;
    let patch: Partial<DiagramElement> = {};

    if (isOwner && (el.properties ?? []).some(p => p.id === propertyId)) {
      patch = {...patch, properties: (el.properties ?? []).filter(p => p.id !== propertyId)};
      changed = true;
    }

    const purgedBindings = purgeElementBindings(el, propertyId, isOwner);
    if (purgedBindings.changed) {
      patch = {...patch, bindings: purgedBindings.bindings};
      changed = true;
    }

    if (el.events?.some(e => refsProperty(e.handler?.propertyRefs, propertyId))) {
      patch = {
        ...patch,
        events: el.events.map(e =>
          refsProperty(e.handler?.propertyRefs, propertyId)
            ? {
                ...e,
                handler: {
                  ...e.handler,
                  propertyRefs: (e.handler.propertyRefs ?? []).filter(r => r.propertyId !== propertyId),
                },
              }
            : e,
        ),
      };
      changed = true;
    }

    if (!changed) return el;
    touched = true;
    return {...el, ...patch} as DiagramElement;
  });

  return touched ? next : elements;
};
