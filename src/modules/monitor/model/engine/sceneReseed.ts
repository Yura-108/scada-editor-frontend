import {cellBindings, cellRuntimeKey, getRenderedElement, getSceneView, isLiveField, propertyByName} from "@/core/scene";
import type {SandboxBinding, ScriptSandbox} from "@/core/runtime";
import {devLog} from "@/shared/lib/devLog";
import type {BindingIndex} from "./bindingIndex";
import {collectResults, EMPTY_RUN, hasKnownTrigger, startBindings} from "./runBindings";
import {applyInOrder, computeNoDataElementKeys, resetBindingErrors, type EngineBuffers} from "./engineBuffers";

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

/**
 * Открытие схемы: сид значений + ПОВТОРНЫЙ ПРОГОН биндингов по уже известным значениям.
 *
 * Зовётся на каждую пересборку индекса — то есть ровно тогда, когда на холст лёг другой
 * документ. Соединение при этом не пересоздаётся, значения тегов сессии остаются на руках, и
 * открытая схема обязана нарисоваться по ним сразу, а не ждать, пока значение изменится.
 *
 * Порядок внутри строгий: сначала сид значений свойств, потом загрузка схемы в песочницу и
 * прогон — иначе биндинги прочитают свойства как null. Прогон асинхронный: батч открытия
 * ложится по ответу песочницы, в общей очереди тактов (`applyInOrder`).
 */
export function reseedScene(
  buf: EngineBuffers,
  idx: BindingIndex,
  sandbox: ScriptSandbox | null,
  publishErrors: (errors: ReadonlyMap<string, string>) => void,
  publishCompileErrors: (errors: ReadonlyMap<string, string>) => void,
) {
  for (const el of getSceneView().elements) {
    for (const p of el.properties ?? []) {
      if (typeof p.id === "number" && idx.propertyIds.has(p.id) && !buf.valuesByProp.has(p.id)) {
        buf.valuesByProp.set(p.id, String(p.default_value ?? ""));
      }
    }
  }

  // Сид ячеек таблиц. Локальная строка до первого WS-апдейта показывает default_value
  // (доку: «до первого изменения»), но ТОЛЬКО если живого значения ещё нет: индекс
  // пересобирается на каждую смену схемы, и безусловная запись дефолта затирала бы
  // значение, уже пришедшее по WS, — ячейка навсегда оставалась бы с дефолтом, если
  // свойство больше не менялось.
  //
  // Теговые ячейки сидируем из уже известных значений сессии: при возврате на схему
  // они иначе пустые, хотя значение лежит в buffers.values. Неизвестного тега не касаемся —
  // до первого кадра элемент под оверлеем «нет данных».
  const propsByKey: Record<string, Record<string, unknown>> = {};
  for (const el of getSceneView().elements) {
    if (el.type !== "table") continue;
    for (const {cell} of cellBindings(el)) {
      if (!isLiveField(cell.field)) continue;
      const p = propertyByName(el, cell.propertyName);
      if (!p) continue;

      if (p.tag_id) {
        const live = buf.values.get(p.tag_id);
        if (live == null) continue;
        (propsByKey[el.key] ??= {})[cellRuntimeKey(cell.row, cell.col)] = live;
        continue;
      }

      const value = buf.valuesByPropName.get(p.name) ?? String(p.default_value ?? "");
      buf.valuesByPropName.set(p.name, value);
      (propsByKey[el.key] ??= {})[cellRuntimeKey(cell.row, cell.col)] = value;
    }

    // Прямые привязки к тегу: без сида схема, открытая после прихода значений,
    // осталась бы со значением по умолчанию — flush исполняет только ИЗМЕНИВШИЕСЯ теги.
    for (const b of el.bindings ?? []) {
      if (b.enabled === false || !b.direct || !b.tag) continue;
      const live = buf.values.get(b.tag);
      if (live == null) continue;
      (propsByKey[el.key] ??= {})[b.directTarget || "value"] = live;
    }
  }

  // Счётчики ошибок и автоотключение живут ровно до пересборки индекса: биндинг,
  // отключённый после серии ошибок на прошлой схеме, обязан снова заработать на новой
  // (и на этой же после перезагрузки). Ошибки исполнения прошлой схемы убираем из
  // плашки «Проблемы с привязками» — тех биндингов на холсте больше нет.
  resetBindingErrors(buf);
  const baseErrors: ReadonlyMap<string, string> = new Map();
  // С этого момента движок показывает эту схему: ответы для прошлой больше не применяются.
  const generation = idx.generation;
  buf.generation = generation;
  buf.notCompiled = new Set();
  publishCompileErrors(baseErrors);

  // Загрузка в песочницу — до прогона: воркер отвечает по порядку, и прогон ниже (как и
  // любой такт после него) увидит уже скомпилированную схему. Ошибки компиляции приходят
  // ответом и попадают в плашку «Проблемы с привязками».
  if (sandbox) {
    const bindings: SandboxBinding[] = idx.all.map(e =>
      ({id: e.binding.id, elementKey: e.elementKey, binding: e.binding, scope: e.scope}));
    sandbox.load(generation, {bindings, events: []}).then(errors => {
      if (!errors || buf.generation !== generation) return;
      const map = new Map(errors.map(e => [e.id, e.error] as const));
      buf.notCompiled = new Set(map.keys());
      for (const e of idx.all) {
        const err = map.get(e.binding.id);
        if (err) console.warn(`[monitor:engine] биндинг «${e.binding.name}» не скомпилирован: ${err}`);
      }
      publishCompileErrors(map);
    }).catch(err => console.warn("[monitor:engine] схема не загружена в песочницу:", err instanceof Error ? err.message : err));
  }

  // Повторный прогон биндингов по УЖЕ ИЗВЕСТНЫМ значениям.
  //
  // Без него схема, открытая после того как значения пришли, остаётся в состоянии по
  // умолчанию навсегда: applyServerComponents обнуляет карту состояний, а flush
  // исполняет только биндинги ИЗМЕНИВШИХСЯ тегов — очередной кадр приносит то же
  // значение, страж no-op его отсекает, и биндинг не выполняется. Ровно этот путь
  // проходит оператор, применивший рецепт на одной схеме и перешедший на другую.
  const byKey = new Map(getSceneView().elements.map(el => [el.key, el] as const));
  const toRun = idx.all.filter(cb => hasKnownTrigger(cb, buf.values, buf.valuesByProp));
  const work = sandbox && toRun.length
    ? startBindings(sandbox, generation, toRun, buf, key => {
      const el = byKey.get(key);
      return el ? getRenderedElement(el) : null;
    })
    : Promise.resolve(EMPTY_RUN);

  // «Нет данных» (B4): тег, по которому ещё не было ни одного сообщения (buffers.tagMeta
  // пуст на самый первый маунт), считается недостоверным — элементы уходят в
  // noDataKeys рантайм-слоя, не дожидаясь первого BAD-кадра. При смене схемы внутри той же
  // сессии buffers.tagMeta уже знает часть тегов, и пересчёт это учитывает.
  //
  // Пишем БЕЗУСЛОВНО, без сравнения с прошлым набором: документ заменён целиком, и
  // ключи прошлой схемы обязаны уйти из стора, даже если сам набор «равен» по составу.
  const initialNoData = computeNoDataElementKeys(idx, buf.tagMeta);
  buf.noDataKeys = initialNoData;

  applyInOrder(buf, work, run => {
    if (!run || buf.generation !== generation) return;
    const {stateNameByKey, propsByKey: nextProps, errors, fired} = collectResults(run, {
      errorCounts: buf.errorCount,
      disabled: buf.disabled,
      notCompiled: buf.notCompiled,
      knownErrors: baseErrors,
    }, propsByKey);

    publishErrors(errors);
    log(`повторный прогон при смене схемы: биндингов ${toRun.length} из ${idx.all.length}, сработало ${fired.length}`);

    // Один батч на всё открытие схемы — один ре-рендер холста.
    getSceneView().applyRuntimeBatch({
      stateNameByKey,
      propsByKey: nextProps,
      noDataKeys: initialNoData,
    });
  });
}
