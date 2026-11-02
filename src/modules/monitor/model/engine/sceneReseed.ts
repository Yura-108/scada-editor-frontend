import {cellBindings, cellRuntimeKey, getRenderedElement, getSceneView, isLiveField, propertyByName} from "@/core/scene";
import {devLog} from "@/shared/lib/devLog";
import type {BindingIndex} from "./bindingIndex";
import {hasKnownTrigger, runBindings} from "./runBindings";
import {computeNoDataElementKeys, resetBindingErrors, type EngineBuffers} from "./engineBuffers";

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

/**
 * Открытие схемы: сид значений + ПОВТОРНЫЙ ПРОГОН биндингов по уже известным значениям.
 *
 * Зовётся на каждую пересборку индекса — то есть ровно тогда, когда на холст лёг другой
 * документ. Соединение при этом не пересоздаётся, значения тегов сессии остаются на руках, и
 * открытая схема обязана нарисоваться по ним сразу, а не ждать, пока значение изменится.
 *
 * Порядок внутри строгий: сначала сид значений свойств, потом прогон — иначе биндинги
 * прочитают свойства как null.
 */
export function reseedScene(
  buf: EngineBuffers,
  idx: BindingIndex,
  publishErrors: (errors: ReadonlyMap<string, string>) => void,
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
  // они иначе пустые, хотя значение лежит в valuesRef. Неизвестного тега не касаемся —
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

  // Повторный прогон биндингов по УЖЕ ИЗВЕСТНЫМ значениям.
  //
  // Без него схема, открытая после того как значения пришли, остаётся в состоянии по
  // умолчанию навсегда: applyServerComponents обнуляет карту состояний, а flush
  // исполняет только биндинги ИЗМЕНИВШИХСЯ тегов — очередной кадр приносит то же
  // значение, страж no-op его отсекает, и биндинг не выполняется. Ровно этот путь
  // проходит оператор, применивший рецепт на одной схеме и перешедший на другую.
  const byKey = new Map(getSceneView().elements.map(el => [el.key, el] as const));
  const toRun = idx.all.filter(cb => hasKnownTrigger(cb, buf.values, buf.valuesByProp));
  const {stateNameByKey, propsByKey: nextProps, errors, fired} = runBindings(toRun, {
    valuesByTagId: buf.values,
    valuesByPropertyId: buf.valuesByProp,
    selfOf: key => {
      const el = byKey.get(key);
      return el ? getRenderedElement(el) : null;
    },
    errorCounts: buf.errorCount,
    disabled: buf.disabled,
    knownErrors: baseErrors,
  }, propsByKey);

  publishErrors(errors);
  log(`повторный прогон при смене схемы: биндингов ${toRun.length} из ${idx.all.length}, сработало ${fired.length}`);

  // «Нет данных» (B4): тег, по которому ещё не было ни одного сообщения (tagMetaRef
  // пуст на самый первый маунт), считается недостоверным — элементы уходят в
  // noDataKeys рантайм-слоя, не дожидаясь первого BAD-кадра. При смене схемы внутри той же
  // сессии tagMetaRef уже знает часть тегов, и пересчёт это учитывает.
  //
  // Пишем БЕЗУСЛОВНО, без сравнения с прошлым набором: документ заменён целиком, и
  // ключи прошлой схемы обязаны уйти из стора, даже если сам набор «равен» по составу.
  const initialNoData = computeNoDataElementKeys(idx, buf.tagMeta);
  buf.noDataKeys = initialNoData;

  // Один батч на всё открытие схемы — один ре-рендер холста.
  getSceneView().applyRuntimeBatch({
    stateNameByKey,
    propsByKey: nextProps,
    noDataKeys: initialNoData,
  });
}
