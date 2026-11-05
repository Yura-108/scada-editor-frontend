import type {BindingIndex} from "./bindingIndex";

/**
 * Буферы движка монитора — всё, что принадлежит сессии значений (WS или воспроизведения архива).
 *
 * Объект один на движок и живёт всё время его жизни; поля переприсваиваются при сбросах,
 * поэтому читать их нужно в момент обращения (`buffers.values.get(…)`), а не сохранять карту
 * в замыкание.
 */
export interface EngineBuffers {
  /**
   * Коалесинг-буфер тика (tag_id → последнее значение). value может быть null — тег с
   * quality != GOOD без последнего достоверного значения.
   */
  pending: Map<string, string | null>;
  /** Последние известные значения всех тегов скоупа (аргументы для исполнения биндингов). */
  values: Map<string, string | null>;
  /** Последнее известное качество/момент снятия по тегу (docs/contract/TAG_CONTRACT_CHANGES.md B1/B3). */
  tagMeta: Map<string, {quality: string; ts?: number}>;
  /**
   * Взводится, когда quality хотя бы одного тега реально изменилось — чтобы не пересчитывать
   * набор «нет данных» (noDataKeys рантайм-слоя) на каждый тик без надобности.
   */
  qualityDirty: boolean;
  /** Последний набор "нет данных", отправленный в стор — для diff перед новым applyRuntimeBatch. */
  noDataKeys: Set<string>;
  /** Зеркальные буферы для свойств других компонентов (properties[] UPDATE), ключ — propertyId. */
  pendingProps: Map<number, string>;
  valuesByProp: Map<number, string>;
  /**
   * Отдельный буфер по имени свойства — только для маршрутизации в ячейки строк таблиц
   * (propertyId нестабилен между пересохранениями таблицы, доку это и требует).
   */
  pendingPropName: Map<string, string>;
  valuesByPropName: Map<string, string>;
  errorCount: Map<string, number>;
  disabled: Set<string>;
  /** binding.id, которые песочница не скомпилировала: их не прогоняем и ошибок исполнения не считаем. */
  notCompiled: Set<string>;
  /**
   * Номер загрузки схемы, которую движок сейчас показывает (`BindingIndex.generation`).
   * Ставит повторный прогон при смене схемы; ответ песочницы для другого номера не применяется.
   */
  generation: number;
  /** Номер сессии значений: растёт на каждый сброс. Ответ, начатый до сброса, не применяется. */
  epoch: number;
  /** Хвост очереди применений: ответы песочницы ложатся на холст строго в порядке тактов. */
  applyTail: Promise<void>;
}

export const newEngineBuffers = (): EngineBuffers => ({
  pending: new Map(),
  values: new Map(),
  tagMeta: new Map(),
  qualityDirty: false,
  noDataKeys: new Set(),
  pendingProps: new Map(),
  valuesByProp: new Map(),
  pendingPropName: new Map(),
  valuesByPropName: new Map(),
  errorCount: new Map(),
  disabled: new Set(),
  notCompiled: new Set(),
  generation: 0,
  epoch: 0,
  applyTail: Promise.resolve(),
});

/**
 * Применить результат асинхронной работы такта — после всех, начатых раньше. Работа идёт
 * сразу (параллельно с прошлыми), а применение — по очереди: иначе поздний ответ прошлого
 * такта лёг бы поверх свежего. Ответ, начатый до сброса сессии, отбрасывается.
 */
export function applyInOrder<T>(b: EngineBuffers, work: Promise<T>, apply: (result: T) => void) {
  const epoch = b.epoch;
  b.applyTail = b.applyTail
    .then(() => work)
    .then(result => { if (b.epoch === epoch) apply(result); })
    .catch(err => console.error("[monitor:engine] такт не применён:", err));
}

/** quality отсутствует или "GOOD" — достоверно; всё остальное — нет (не сравнивать на "BAD"). */
export const isTagQualityGood = (quality?: string) => quality === undefined || quality === "GOOD";

export const setsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every(k => b.has(k));

/**
 * Элементы, у которых хотя бы один тег-свойство сейчас недостоверен (quality != GOOD)
 * ИЛИ по нему ещё не было ни одного сообщения (холодный старт, docs/contract/TAG_CONTRACT_CHANGES.md B4).
 */
export const computeNoDataElementKeys = (
  idx: BindingIndex,
  tagMeta: ReadonlyMap<string, {quality: string; ts?: number}>,
): Set<string> => {
  const result = new Set<string>();
  for (const [tagId, keys] of idx.elementKeysByTagId) {
    const meta = tagMeta.get(tagId);
    const bad = !meta || !isTagQualityGood(meta.quality);
    if (bad) for (const k of keys) result.add(k);
  }
  return result;
};

/**
 * Кадр тегов — в коалесинг-буфер и качество. Общий путь `SNAPSHOT`, `UPDATE` и `archive.apply`.
 * Несколько апдейтов одного тега в батче: Map даёт last-write-wins. quality отсутствует у
 * сегодняшнего бэкенда — трактуем как GOOD (совместимость).
 *
 * Только `pending`, НЕ `values`: предзапись `values` заставила бы no-op-страж во flush счесть
 * изменение отсутствующим, и ни одна привязка не сработала бы.
 */
export function ingestTags(
  b: EngineBuffers,
  tags: readonly {tagId: string; value: string | null; ts?: number; quality?: string}[],
) {
  for (const t of tags) {
    b.pending.set(t.tagId, t.value);
    const quality = t.quality ?? "GOOD";
    const prevMeta = b.tagMeta.get(t.tagId);
    if (!prevMeta || prevMeta.quality !== quality) b.qualityDirty = true;
    b.tagMeta.set(t.tagId, {quality, ts: t.ts});
  }
}

/**
 * properties[] — записи серверных Java-скриптов в свойства компонентов; маршрутизируются по
 * propertyId (значение → строка, toScopeValue распарсит). Плюс по propertyName — отдельный путь
 * для live-ячеек строк таблиц: propertyId нестабилен между пересохранениями таблицы, а имя — нет.
 */
export function ingestProperties(
  b: EngineBuffers,
  properties: readonly {propertyId: number; propertyName?: string; value: unknown}[],
) {
  for (const p of properties) {
    b.pendingProps.set(p.propertyId, String(p.value));
    if (p.propertyName) b.pendingPropName.set(p.propertyName, String(p.value));
  }
}

/**
 * Значения, записанные оператором в ПЛК, — в тот же буфер, что телеметрия. Тег, по которому
 * кадров ещё не было, после подтверждённой записи перестаёт считаться «нет данных» — иначе
 * оверлей лёг бы поверх того, что оператор сам и записал. Уже известное качество не трогаем:
 * замазывать чужой BAD своей записью нельзя, недостоверность тега от неё не исчезает.
 */
export function ingestOperatorWrites(b: EngineBuffers, writes: readonly {tagId: string; value: string}[]) {
  for (const {tagId, value} of writes) {
    b.pending.set(tagId, value);
    if (!b.tagMeta.has(tagId)) {
      b.tagMeta.set(tagId, {quality: "GOOD", ts: Date.now()});
      b.qualityDirty = true;
    }
  }
}

/**
 * Тег, выпавший из подписки на сцену, больше не обновляется: держим только теги, для которых
 * `keep` истинно. Возвращает число сброшенных значений; сброс взводит пересчёт «нет данных».
 */
export function dropTags(b: EngineBuffers, keep: (tag: string) => boolean): number {
  let dropped = 0;
  for (const map of [b.values, b.pending, b.tagMeta]) {
    for (const tag of [...map.keys()]) {
      if (keep(tag)) continue;
      map.delete(tag);
      dropped++;
    }
  }
  if (dropped) b.qualityDirty = true;
  return dropped;
}

/** Счётчики ошибок и автоотключение — заново (смена схемы, сброс сессии). */
export function resetBindingErrors(b: EngineBuffers) {
  b.errorCount = new Map();
  b.disabled = new Set();
}

/** Сброс всей сессии значений: при выходе из живого режима и из архива. */
export function resetSessionBuffers(b: EngineBuffers) {
  b.epoch++;
  b.pending = new Map();
  b.values = new Map();
  // Теневой буфер живых значений тоже принадлежит сессии: без сброса «снять подмену»
  // после переподключения вернуло бы значение из прошлой сессии.
  b.pendingProps = new Map();
  b.valuesByProp = new Map();
  b.pendingPropName = new Map();
  b.valuesByPropName = new Map();
  resetBindingErrors(b);
  b.tagMeta = new Map();
  b.qualityDirty = false;
  b.noDataKeys = new Set();
}

/** Перемотка архива: значения тегов и качество — с чистого листа, свойства остаются. */
export function resetArchiveBuffers(b: EngineBuffers) {
  b.epoch++;
  b.pending = new Map();
  b.values = new Map();
  b.tagMeta = new Map();
  // Ни у одного тега ещё нет точки — «нет данных» пересчитается на первом apply.
  b.qualityDirty = true;
  b.noDataKeys = new Set();
  resetBindingErrors(b);
}
