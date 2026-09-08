import {executeBinding, type CompiledBinding} from "@/lib/runtime/executeBinding";

/**
 * Прогон набора биндингов по текущим значениям — общая часть тика движка и повторного
 * прогона при смене схемы.
 *
 * Вынесено из `flush`, потому что прогонов теперь два, а трактовка ошибок обязана
 * остаться одна: скопированный цикл рано или поздно разъедется с оригиналом в счётчике
 * ошибок или в автоотключении, и разойдётся молча — на экране это выглядит как
 * «биндинг иногда не работает».
 *
 * Модуль намеренно не знает про стор: элемент для `self` отдаёт вызывающий (`selfOf`),
 * карты счётчиков передаются снаружи и мутируются здесь же — они живут в рефах движка.
 */

/** Столько ошибок исполнения ПОДРЯД отключают биндинг до пересборки индекса (смены/перезагрузки схемы). */
export const MAX_CONSECUTIVE_ERRORS = 5;

export interface RunBindingsCtx {
  valuesByTagId: ReadonlyMap<string, string | null>;
  valuesByPropertyId: ReadonlyMap<number, string>;
  /** `self` для кода биндинга: движок отдаёт `getRenderedElement(el)`, либо `null`, если элемента нет. */
  selfOf: (elementKey: string) => unknown;
  /** binding.id → ошибок подряд. Мутируется: сброс в 0 при удачном исполнении. */
  errorCounts: Map<string, number>;
  /** binding.id отключённых биндингов. Мутируется при достижении лимита ошибок. */
  disabled: Set<string>;
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

export const runBindings = (
  bindings: Iterable<CompiledBinding>,
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

  for (const cb of bindings) {
    const bindingId = cb.binding.id;
    if (ctx.disabled.has(bindingId)) continue;

    const res = executeBinding(
      cb,
      ctx.valuesByTagId,
      ctx.valuesByPropertyId,
      ctx.selfOf(cb.elementKey),
    );

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
  cb: CompiledBinding,
  valuesByTagId: ReadonlyMap<string, string | null>,
  valuesByPropertyId: ReadonlyMap<number, string>,
): boolean =>
  cb.triggerTagIds.some(tagId => valuesByTagId.has(tagId))
  || cb.triggerPropertyIds.some(propertyId => valuesByPropertyId.has(propertyId));
