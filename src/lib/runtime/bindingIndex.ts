import type {DiagramElement} from "@/types/editorElement.type";
import {collectTagScope} from "@/lib/runtime/bindingScope";
import {compileBinding, type CompiledBinding} from "@/lib/runtime/executeBinding";

export interface BindingIndex {
  /** tag_id → биндинги, которые он триггерит (O(1)-маршрутизация входящего значения). */
  byTagId: Map<string, CompiledBinding[]>;
  /** Все скомпилированные биндинги (для сида/повторного прогона). */
  all: CompiledBinding[];
  /** binding.id → сообщение ошибки компиляции (для индикации во вкладке «Привязки»). */
  compileErrors: Map<string, string>;
  /** Все tag_id, задействованные скомпилированными биндингами. */
  tagIds: Set<string>;
}

/**
 * Строит индекс биндингов сцены: скоуп по свойствам-тегам каждого элемента,
 * компиляция каждого включённого биндинга (один раз — на горячем пути только
 * вызов), маршрутизация tag_id → CompiledBinding[].
 */
export const buildBindingIndex = (elements: DiagramElement[]): BindingIndex => {
  const byTagId = new Map<string, CompiledBinding[]>();
  const all: CompiledBinding[] = [];
  const compileErrors = new Map<string, string>();
  const tagIds = new Set<string>();

  for (const el of elements) {
    const bindings = el.bindings ?? [];
    if (!bindings.length) continue;

    const scope = collectTagScope(el.properties);

    for (const binding of bindings) {
      if (!binding.enabled) continue;

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
    }
  }

  console.log(
    `[monitor:engine] индекс собран: биндингов ${all.length}, ошибок компиляции ${compileErrors.size}, отслеживаемых тегов ${tagIds.size}`,
  );
  if (tagIds.size) console.table([...tagIds].map(tagId => ({tagId})));

  return {byTagId, all, compileErrors, tagIds};
};
