import {devLog, isDev} from "@/shared/lib/devLog";
import type {DiagramElement} from "@/core/scene";
import {bindingEntry, collectTagScope, withPropertyRefs, type BindingEntry} from "@/core/runtime";
import {cellBindings, isLiveField, propertyByName} from "@/core/scene";

/** Ячейка таблицы, в которую пишется живое значение свойства (см. tableBindings.ts). */
export interface TableCellTarget {
  elementKey: string;
  row: number;
  col: number;
}

/** Куда пишет прямая привязка к тегу: элемент и ключ его рендер-пропа (обычно `value`). */
export interface DirectTagTarget {
  elementKey: string;
  target: string;
}

export interface BindingIndex {
  /**
   * Номер загрузки схемы в песочницу: свой у каждого индекса. Ответ песочницы на другой номер
   * относится к другой схеме и не применяется.
   */
  generation: number;
  /** tag_id → биндинги, которые он триггерит (O(1)-маршрутизация входящего значения). */
  byTagId: Map<string, BindingEntry[]>;
  /** propertyId → биндинги, которые он триггерит (маршрутизация properties[] UPDATE). */
  byPropertyId: Map<number, BindingEntry[]>;
  /**
   * Все JS-биндинги схемы (для загрузки в песочницу и повторного прогона). Компилирует их
   * песочница: ошибки компиляции приходят ответом на загрузку (`reseedScene`).
   */
  all: BindingEntry[];
  /** Все tag_id, задействованные биндингами. */
  tagIds: Set<string>;
  /** Все propertyId, задействованные биндингами. */
  propertyIds: Set<number>;
  /** tag_id → ячейки таблиц, привязанные к этому тегу (привязка ячейки, НЕ JS-биндинг). */
  tableCellsByTagId: Map<string, TableCellTarget[]>;
  /** Имя локального свойства → ячейки таблиц (WS properties[] по propertyName). */
  tableCellsByPropertyName: Map<string, TableCellTarget[]>;
  /**
   * tag_id → элементы, у которых этот тег — свойство типа "Тег" (`property_type
   * === "Тег" && tag_id`), НЕЗАВИСИМО от наличия скомпилированного JS-биндинга.
   * Нужна для «нет данных» при quality != GOOD (docs/contract/TAG_CONTRACT_CHANGES.md B2):
   * «привязан к тегу» — это наличие тег-свойства на компоненте, а не наличие
   * биндинга (у таблиц тег пишется в ячейку напрямую, минуя биндинги).
   */
  elementKeysByTagId: Map<string, Set<string>>;
  /**
   * tag_id → прямые привязки «значение элемента ← тег» (`direct` + `tag`, без кода).
   *
   * Отдельно от `byTagId`: там JS-биндинги, которые надо исполнять, а здесь запись
   * значения напрямую — тот же приём, что у живых ячеек таблиц. Благодаря ему элементу
   * не нужно собственных свойств, чтобы следить за тегом.
   */
  directTagsByTagId: Map<string, DirectTagTarget[]>;
}

let lastGeneration = 0;

/**
 * Строит индекс биндингов сцены: скоуп по свойствам-тегам каждого элемента, триггеры
 * каждого включённого биндинга, маршрутизация tag_id → BindingEntry[]. Код здесь не
 * компилируется — это делает песочница при загрузке схемы.
 */
export const buildBindingIndex = (elements: DiagramElement[]): BindingIndex => {
  const byTagId = new Map<string, BindingEntry[]>();
  const byPropertyId = new Map<number, BindingEntry[]>();
  const all: BindingEntry[] = [];
  const tagIds = new Set<string>();
  const propertyIds = new Set<number>();
  const tableCellsByTagId = new Map<string, TableCellTarget[]>();
  const tableCellsByPropertyName = new Map<string, TableCellTarget[]>();
  const elementKeysByTagId = new Map<string, Set<string>>();
  const directTagsByTagId = new Map<string, DirectTagTarget[]>();

  for (const el of elements) {
    for (const p of el.properties ?? []) {
      if (p.property_type !== "Тег" || !p.tag_id) continue;
      const set = elementKeysByTagId.get(p.tag_id);
      if (set) set.add(el.key); else elementKeysByTagId.set(p.tag_id, new Set([el.key]));
    }

    // Живые значения ячеек: цели берём из ПРИВЯЗОК, а не из position. Одно свойство
    // может кормить несколько ячеек — списки целей это допускают.
    for (const {cell} of cellBindings(el)) {
      if (!isLiveField(cell.field)) continue;
      const p = propertyByName(el, cell.propertyName);
      if (!p) continue;
      const target: TableCellTarget = {elementKey: el.key, row: cell.row, col: cell.col};
      if (p.tag_id) {
        const list = tableCellsByTagId.get(p.tag_id);
        if (list) list.push(target); else tableCellsByTagId.set(p.tag_id, [target]);
      } else if (p.name) {
        const list = tableCellsByPropertyName.get(p.name);
        if (list) list.push(target); else tableCellsByPropertyName.set(p.name, [target]);
      }
    }

    // Прямые привязки к тегу: значение уедет в рендер-проп без исполнения кода.
    for (const b of el.bindings ?? []) {
      if (b.enabled === false || !b.direct || !b.tag) continue;
      const target: DirectTagTarget = {elementKey: el.key, target: b.directTarget || "value"};
      const list = directTagsByTagId.get(b.tag);
      if (list) list.push(target); else directTagsByTagId.set(b.tag, [target]);
      // «Привязан к тегу» для оверлея «нет данных»: у такой привязки своего свойства нет,
      // и без этой строки элемент не считался бы связанным с тегом.
      const set = elementKeysByTagId.get(b.tag);
      if (set) set.add(el.key); else elementKeysByTagId.set(b.tag, new Set([el.key]));
    }

    const bindings = el.bindings ?? [];
    if (!bindings.length) continue;

    // Тег-скоуп общий для элемента; свойства-ссылки — пер-биндинговые.
    const tagScope = collectTagScope(el.properties);

    for (const binding of bindings) {
      if (!binding.enabled) continue;
      // Прямая привязка к тегу — не JS: код у неё пуст, значение пишет рантайм по
      // маршруту выше. Компилировать её значило бы держать в `all` пустой биндинг,
      // который гоняется при каждой смене схемы и попадает в счётчик проблем.
      if (binding.direct && binding.tag) continue;

      const scope = withPropertyRefs(tagScope, binding.propertyRefs);
      const compiled = bindingEntry(el.key, binding, scope);
      all.push(compiled);
      for (const tagId of compiled.triggerTagIds) {
        tagIds.add(tagId);
        const list = byTagId.get(tagId);
        if (list) list.push(compiled);
        else byTagId.set(tagId, [compiled]);
      }
      for (const propertyId of compiled.triggerPropertyIds) {
        propertyIds.add(propertyId);
        const list = byPropertyId.get(propertyId);
        if (list) list.push(compiled);
        else byPropertyId.set(propertyId, [compiled]);
      }
    }
  }

  devLog(
    `[monitor:engine] индекс собран: биндингов ${all.length}, отслеживаемых тегов ${tagIds.size}, свойств ${propertyIds.size}`,
  );
  if (isDev) {
    if (tagIds.size) console.table([...tagIds].map(tagId => ({tagId})));
    if (propertyIds.size) console.table([...propertyIds].map(propertyId => ({propertyId})));
  }

  return {
    generation: ++lastGeneration,
    byTagId, byPropertyId, all, tagIds, propertyIds,
    tableCellsByTagId, tableCellsByPropertyName, elementKeysByTagId,
    directTagsByTagId,
  };
};
