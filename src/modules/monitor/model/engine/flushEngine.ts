import {cellRuntimeKey, getRenderedElement, getSceneView} from "@/core/scene";
import type {BindingEntry, ScriptSandbox} from "@/core/runtime";
import {devLog, isDev} from "@/shared/lib/devLog";
import type {BindingIndex} from "./bindingIndex";
import {collectResults, EMPTY_RUN, startBindings} from "./runBindings";
import {applyInOrder, computeNoDataElementKeys, setsEqual, type EngineBuffers} from "./engineBuffers";

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

/**
 * Тик движка: изменившиеся значения из буферов → привязки → один `applyRuntimeBatch`.
 *
 * Синхронно — только буферы: защита от повторов, «нет данных», ячейки таблиц и прямые
 * привязки. JS-привязки выполняет песочница; батч (ячейки вместе с интентами — по-прежнему
 * один на такт) ложится по её ответу, строго в порядке тактов (`applyInOrder`). Ответ для
 * другой схемы не применяется: её повторный прогон (`reseedScene`) покрывает всё сам.
 *
 * `knownErrors` — текущие ошибки исполнения (для автоотключения) на момент ответа,
 * `publishErrors` — новая карта.
 */
export function flushEngine(
  buf: EngineBuffers,
  idx: BindingIndex | null,
  sandbox: ScriptSandbox | null,
  knownErrors: () => ReadonlyMap<string, string>,
  publishErrors: (errors: ReadonlyMap<string, string>) => void,
) {
  const pending = buf.pending;
  const pendingProps = buf.pendingProps;
  const pendingNames = buf.pendingPropName;
  // Пересчёт «нет данных» без значений — после сброса архива, когда у тегов ещё нет ни
  // одной точки: оверлей обязан лечь, даже если применять нечего.
  if (!idx || (!pending.size && !pendingProps.size && !pendingNames.size && !buf.qualityDirty)) return;
  buf.pending = new Map();
  buf.pendingProps = new Map();
  buf.pendingPropName = new Map();

  // Слой no-op №1: то же сырое значение — тег/свойство не считается изменившимся.
  //
  // Записанное оператором значение приходит сюда тем же путём, что и телеметрия (см.
  // мост записи `onTagsWritten` в движке), и никакого приоритета не имеет: следующий кадр по этому тегу
  // просто перезапишет его. Именно поэтому показ не «залипает» на записанном.
  const affected = new Set<BindingEntry>();
  const changedTags: {tagId: string; value: string | null}[] = [];
  for (const [tagId, value] of pending) {
    if (buf.values.get(tagId) === value) continue;
    buf.values.set(tagId, value);
    changedTags.push({tagId, value});
    for (const cb of idx.byTagId.get(tagId) ?? []) affected.add(cb);
  }

  // «Нет данных» (B2/B4): пересчитываем только если у какого-то тега реально
  // сменилось quality (взводится в onUpdate) — независимо от того, изменилось
  // ли при этом само значение (quality могла смениться при том же value).
  let noDataKeys: Set<string> | undefined;
  if (buf.qualityDirty) {
    buf.qualityDirty = false;
    const next = computeNoDataElementKeys(idx, buf.tagMeta);
    if (!setsEqual(next, buf.noDataKeys)) {
      buf.noDataKeys = next;
      noDataKeys = next;
    }
  }
  const changedProps: {propertyId: number; value: string}[] = [];
  for (const [propertyId, value] of pendingProps) {
    if (buf.valuesByProp.get(propertyId) === value) continue;
    buf.valuesByProp.set(propertyId, value);
    changedProps.push({propertyId, value});
    for (const cb of idx.byPropertyId.get(propertyId) ?? []) affected.add(cb);
  }
  const changedNames: {name: string; value: string}[] = [];
  for (const [name, value] of pendingNames) {
    if (buf.valuesByPropName.get(name) === value) continue;
    buf.valuesByPropName.set(name, value);
    changedNames.push({name, value});
  }

  // Живые значения ячеек таблиц (тег- и локальные, маршрутизация по tag_id/имени,
  // НЕ через BindingEntry — это не JS-биндинги, а прямая запись в ячейку,
  // адрес которой задан привязкой; см. tableBindings.ts).
  const tableRowProps: Record<string, Record<string, unknown>> = {};
  for (const {tagId, value} of changedTags) {
    for (const target of idx.tableCellsByTagId.get(tagId) ?? []) {
      (tableRowProps[target.elementKey] ??= {})[cellRuntimeKey(target.row, target.col)] = value;
    }
  }
  for (const {name, value} of changedNames) {
    for (const target of idx.tableCellsByPropertyName.get(name) ?? []) {
      (tableRowProps[target.elementKey] ??= {})[cellRuntimeKey(target.row, target.col)] = value;
    }
  }

  // Прямые привязки «значение элемента ← тег» (прогресс-бар и т.п.): тем же путём,
  // что ячейки, — без исполнения кода, элементу не нужно собственных свойств.
  for (const {tagId, value} of changedTags) {
    for (const target of idx.directTagsByTagId.get(tagId) ?? []) {
      (tableRowProps[target.elementKey] ??= {})[target.target] = value;
    }
  }

  if (!affected.size && !Object.keys(tableRowProps).length && !noDataKeys) return;

  const byKey = new Map(getSceneView().elements.map(el => [el.key, el] as const));
  const selfOf = (key: string) => {
    const el = byKey.get(key);
    return el ? getRenderedElement(el) : null;
  };
  const generation = idx.generation;
  const work = sandbox && affected.size
    ? startBindings(sandbox, generation, affected, buf, selfOf)
    : Promise.resolve(EMPTY_RUN);

  applyInOrder(buf, work, run => {
    if (!run || buf.generation !== generation) return;
    // Тот же разбор, что и при смене схемы, — одна трактовка ошибок и автоотключения.
    const {stateNameByKey, propsByKey, errors, fired} = collectResults(run, {
      errorCounts: buf.errorCount,
      disabled: buf.disabled,
      notCompiled: buf.notCompiled,
      knownErrors: knownErrors(),
    }, tableRowProps);

    publishErrors(errors);

    // Только при разработке: таблицы на каждый тик (сотни тегов) в рабочей сборке забивали
    // консоль оператора и держали в памяти копии значений.
    if (isDev) {
      console.groupCollapsed(
        `[monitor:engine] тик: изменилось тегов ${changedTags.length}, свойств ${changedProps.length}, локальных строк ${changedNames.length}, затронуто биндингов ${affected.size}, сработало ${fired.length}`,
      );
      if (changedTags.length) console.table(changedTags);
      if (changedProps.length) console.table(changedProps);
      if (changedNames.length) console.table(changedNames);
      if (fired.length) console.table(fired);
      console.groupEnd();
    }

    if (Object.keys(stateNameByKey).length || Object.keys(propsByKey).length || noDataKeys) {
      // Слои no-op №2/№3 (то же состояние/значение, пустой батч) — внутри
      // applyRuntimeBatch: без фактических изменений set() не вызывается.
      log("применяю батч:", {stateNameByKey, propsByKey, noDataKeys});
      getSceneView().applyRuntimeBatch({stateNameByKey, propsByKey, noDataKeys});
    }
  });
}
