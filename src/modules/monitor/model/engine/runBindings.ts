import {
  SandboxRestartedError, SandboxTimeoutError, type BindingEntry, type BindingRunResult, type SandboxValues,
  type ScriptSandbox,
} from "@/core/runtime";
import type {EngineBuffers} from "./engineBuffers";

/**
 * Прогон набора биндингов в песочнице — общая часть тика движка и повторного прогона при
 * смене схемы.
 *
 * Прогон разделён на две половины: `startBindings` в момент такта снимает значения и
 * отправляет запрос, `collectResults` по ответу считает ошибки и собирает интенты. Трактовка
 * ошибок обязана остаться одна на оба пути: скопированный цикл рано или поздно разъедется с
 * оригиналом в счётчике ошибок или в автоотключении, и разойдётся молча — на экране это
 * выглядит как «биндинг иногда не работает».
 *
 * Модуль намеренно не знает про стор: элемент для `self` отдаёт вызывающий (`selfOf`),
 * карты счётчиков передаются снаружи и мутируются здесь же — они живут в буферах движка.
 */

/** Столько ошибок исполнения ПОДРЯД отключают биндинг до пересборки индекса (смены/перезагрузки схемы). */
export const MAX_CONSECUTIVE_ERRORS = 5;

/** Запущенный прогон: какие биндинги ушли и ответ песочницы. */
export interface StartedRun {
  byId: ReadonlyMap<string, BindingEntry>;
  results: BindingRunResult[];
  /** Зависшие биндинги (не ответили за срок даже поодиночке). */
  hung: string[];
}

/** Прогонять нечего — такт применяет только ячейки таблиц и прямые привязки. */
export const EMPTY_RUN: StartedRun = {byId: new Map(), results: [], hung: []};

/**
 * Значения скоупов набора биндингов из буферов движка. Отсутствующее — явно (`null`): в
 * воркере могло остаться значение прошлой сессии, а скрипт должен видеть то же, что страница.
 */
const scopeValuesOf = (entries: Iterable<BindingEntry>, buf: EngineBuffers): SandboxValues => {
  const tags = new Map<string, string | null>();
  const props = new Map<number, string | null>();
  for (const e of entries) {
    for (const tagId of Object.values(e.scope.tagIdByName)) {
      if (!tags.has(tagId)) tags.set(tagId, buf.values.get(tagId) ?? null);
    }
    for (const propertyId of Object.values(e.scope.propertyIdByName)) {
      if (!props.has(propertyId)) props.set(propertyId, buf.valuesByProp.get(propertyId) ?? null);
    }
  }
  return {tags: [...tags], props: [...props]};
};

/**
 * Ответ песочницы на набор привязок. Не уложился в срок — неизвестно, какая из пакета
 * зависла: прогоняем их по одной, и зависшая попадает в `hung`, а остальные отвечают. Воркер,
 * перезапущенный из-за чужого запроса (клик), — повторяем один раз. `null` — ответ не для
 * этой схемы (или песочница закрыта): такт не применяется.
 */
const runInSandbox = async (
  sandbox: ScriptSandbox,
  generation: number,
  items: {id: string; self: unknown}[],
  retried = false,
): Promise<{results: BindingRunResult[]; hung: string[]} | null> => {
  try {
    const results = await sandbox.runBindings(generation, items);
    return results && {results, hung: []};
  } catch (err) {
    if (err instanceof SandboxRestartedError && !retried) return runInSandbox(sandbox, generation, items, true);
    if (!(err instanceof SandboxTimeoutError)) {
      console.warn("[monitor:engine] привязки не выполнены:", err instanceof Error ? err.message : err);
      return null;
    }
    if (items.length === 1) return {results: [], hung: [items[0].id]};
    const out = {results: [] as BindingRunResult[], hung: [] as string[]};
    for (const item of items) {
      const r = await runInSandbox(sandbox, generation, [item]);
      if (!r) return null;
      out.results.push(...r.results);
      out.hung.push(...r.hung);
    }
    return out;
  }
};

/**
 * Отправить набор привязок в песочницу. Значения и `self` снимаются СЕЙЧАС — в момент такта;
 * отключённые и нескомпилированные не уходят.
 */
export const startBindings = (
  sandbox: ScriptSandbox,
  generation: number,
  entries: Iterable<BindingEntry>,
  buf: EngineBuffers,
  selfOf: (elementKey: string) => unknown,
): Promise<StartedRun | null> => {
  const byId = new Map<string, BindingEntry>();
  for (const e of entries) {
    if (!buf.disabled.has(e.binding.id) && !buf.notCompiled.has(e.binding.id)) byId.set(e.binding.id, e);
  }
  if (!byId.size) return Promise.resolve(EMPTY_RUN);
  sandbox.setValues(generation, scopeValuesOf(byId.values(), buf));
  const items = [...byId.values()].map(e => ({id: e.binding.id, self: selfOf(e.elementKey)}));
  return runInSandbox(sandbox, generation, items).then(r => r && {byId, ...r});
};

export interface RunBindingsCtx {
  /** binding.id → ошибок подряд. Мутируется: сброс в 0 при удачном исполнении. */
  errorCounts: Map<string, number>;
  /** binding.id отключённых биндингов. Мутируется при достижении лимита ошибок и при зависании. */
  disabled: Set<string>;
  /** binding.id, не скомпилированные песочницей: их ответ («не загружена») не считается ошибкой. */
  notCompiled: ReadonlySet<string>;
  /** Ошибки исполнения на входе; копируются лениво, только если ошибка реально случилась. */
  knownErrors: ReadonlyMap<string, string>;
}

export interface RunBindingsResult {
  stateNameByKey: Record<string, string>;
  propsByKey: Record<string, Record<string, unknown>>;
  /** Та же ссылка, что `knownErrors`, если новых ошибок не было — вызывающий сравнивает по identity. */
  errors: ReadonlyMap<string, string>;
  /** Для отладочного лога тика: какой биндинг какие интенты выдал. */
  fired: {binding: string; intents: string}[];
}

export const collectResults = (
  run: StartedRun,
  ctx: RunBindingsCtx,
  /**
   * Готовые патчи свойств (живые ячейки таблиц), поверх которых лягут интенты биндингов.
   * Вложенные объекты мутируются, поэтому передавать сюда можно только карту, созданную
   * вызывающим для этого прогона.
   */
  seedPropsByKey?: Record<string, Record<string, unknown>>,
): RunBindingsResult => {
  const stateNameByKey: Record<string, string> = {};
  const propsByKey: Record<string, Record<string, unknown>> = {...(seedPropsByKey ?? {})};
  const fired: {binding: string; intents: string}[] = [];
  let newErrors: Map<string, string> | null = null;

  for (const bindingId of run.hung) {
    const cb = run.byId.get(bindingId);
    ctx.disabled.add(bindingId);
    newErrors = newErrors ?? new Map(ctx.knownErrors);
    newErrors.set(bindingId, "не ответил вовремя (бесконечный цикл?) — отключён до перезагрузки схемы");
    console.warn(`[monitor:engine] биндинг «${cb?.binding.name ?? bindingId}» завис и ОТКЛЮЧЁН`);
  }

  for (const res of run.results) {
    const cb = run.byId.get(res.id);
    if (!cb || ctx.notCompiled.has(res.id)) continue;
    const bindingId = res.id;

    if ("error" in res) {
      const count = (ctx.errorCounts.get(bindingId) ?? 0) + 1;
      ctx.errorCounts.set(bindingId, count);
      newErrors = newErrors ?? new Map(ctx.knownErrors);
      newErrors.set(bindingId, res.error);
      console.warn(
        `[monitor:engine] биндинг «${cb.binding.name}» ошибка исполнения (${count}/${MAX_CONSECUTIVE_ERRORS}): ${res.error}`,
      );
      if (count >= MAX_CONSECUTIVE_ERRORS) {
        ctx.disabled.add(bindingId);
        console.warn(
          `[monitor:engine] биндинг «${cb.binding.name}» ОТКЛЮЧЁН после ${count} ошибок подряд`,
        );
      }
      continue;
    }

    ctx.errorCounts.set(bindingId, 0);
    if (res.intents.length) {
      fired.push({
        binding: cb.binding.name,
        intents: res.intents
          .map(i => i.kind === "state" ? `setState("${i.stateName}")` : `setProp("${i.key}", ${JSON.stringify(i.value)})`)
          .join(", "),
      });
    }
    for (const intent of res.intents) {
      if (intent.kind === "state") {
        stateNameByKey[cb.elementKey] = intent.stateName;
      } else {
        (propsByKey[cb.elementKey] ??= {})[intent.key] = intent.value;
      }
    }
  }

  return {stateNameByKey, propsByKey, errors: newErrors ?? ctx.knownErrors, fired};
};

/**
 * Стоит ли прогонять биндинг при смене схемы: хотя бы одно значение из его триггеров уже
 * известно сессии.
 *
 * Без этого фильтра биндинг элемента, по тегам которого не пришло ещё ни одного кадра,
 * посчитал бы состояние по `null`-ам и выставил его как достоверное. Сегодня до первого
 * кадра он просто не исполняется, а элемент сидит под оверлеем «нет данных» — это
 * поведение холодного старта и сохраняем.
 *
 * Осознанное исключение — свойства: их движок сидирует из `default_value` перед прогоном,
 * поэтому биндинг, который зависит ТОЛЬКО от свойств соседних компонентов, считается
 * готовым к исполнению всегда. Так и задумано: `default_value` — это документированное
 * значение «до первого изменения», а не пробел в данных, и живое значение сессии его
 * перебивает (страж `!has` в сиде).
 */
export const hasKnownTrigger = (
  cb: BindingEntry,
  valuesByTagId: ReadonlyMap<string, string | null>,
  valuesByPropertyId: ReadonlyMap<number, string>,
): boolean =>
  cb.triggerTagIds.some(tagId => valuesByTagId.has(tagId))
  || cb.triggerPropertyIds.some(propertyId => valuesByPropertyId.has(propertyId));
