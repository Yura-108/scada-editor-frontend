import {devLog, isDev} from "@/lib/devLog";
import type {DiagramElement} from "@/types/editorElement.type";
import {collectTagScope, withPropertyRefs} from "@/lib/runtime/bindingScope";
import {compileBinding, type CompiledBinding} from "@/lib/runtime/executeBinding";
import {cellBindings, isLiveField, propertyByName} from "@/lib/editor/tableBindings";

/** Ячейка таблицы, в которую пишется живое значение свойства (см. tableBindings.ts). */
export interface TableCellTarget {
  elementKey: string;
  row: number;
  col: number;
}

export interface BindingIndex {
  /** tag_id → биндинги, которые он триггерит (O(1)-маршрутизация входящего значения). */
  byTagId: Map<string, CompiledBinding[]>;
  /** propertyId → биндинги, которые он триггерит (маршрутизация properties[] UPDATE). */
  byPropertyId: Map<number, CompiledBinding[]>;
  /** Все скомпилированные биндинги (для сида/повторного прогона). */
  all: CompiledBinding[];
  /** binding.id → сообщение ошибки компиляции (для индикации во вкладке «Привязки»). */
  compileErrors: Map<string, string>;
  /** Все tag_id, задействованные скомпилированными биндингами. */
  tagIds: Set<string>;
  /** Все propertyId, задействованные скомпилированными биндингами. */
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
}

/**
 * Строит индекс биндингов сцены: скоуп по свойствам-тегам каждого элемента,
 * компиляция каждого включённого биндинга (один раз — на горячем пути только
 * вызов), маршрутизация tag_id → CompiledBinding[].
 */
export const buildBindingIndex = (elements: DiagramElement[]): BindingIndex => {
  const byTagId = new Map<string, CompiledBinding[]>();
  const byPropertyId = new Map<number, CompiledBinding[]>();
  const all: CompiledBinding[] = [];
  const compileErrors = new Map<string, string>();
  const tagIds = new Set<string>();
  const propertyIds = new Set<number>();
  const tableCellsByTagId = new Map<string, TableCellTarget[]>();
  const tableCellsByPropertyName = new Map<string, TableCellTarget[]>();
  const elementKeysByTagId = new Map<string, Set<string>>();

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

    const bindings = el.bindings ?? [];
    if (!bindings.length) continue;

    // Тег-скоуп общий для элемента; свойства-ссылки — пер-биндинговые.
    const tagScope = collectTagScope(el.properties);

    for (const binding of bindings) {
      if (!binding.enabled) continue;

      const scope = withPropertyRefs(tagScope, binding.propertyRefs);
      const compiled = compileBinding(el.key, binding, scope);
      if ("error" in compiled) {
        compileErrors.set(binding.id, compiled.error);
        console.warn(`[monitor:engine] биндинг «${binding.name}» не скомпилирован: ${compiled.error}`);
        continue;
      }

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
    `[monitor:engine] индекс собран: биндингов ${all.length}, ошибок компиляции ${compileErrors.size}, отслеживаемых тегов ${tagIds.size}, свойств ${propertyIds.size}`,
  );
  if (isDev) {
    if (tagIds.size) console.table([...tagIds].map(tagId => ({tagId})));
    if (propertyIds.size) console.table([...propertyIds].map(propertyId => ({propertyId})));
  }

  return {
    byTagId, byPropertyId, all, compileErrors, tagIds, propertyIds,
    tableCellsByTagId, tableCellsByPropertyName, elementKeysByTagId,
  };
};
