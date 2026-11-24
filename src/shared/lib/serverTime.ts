/**
 * Время бэкенда редактора. Часть ответов (журнал базы каналов, история версий, выпуски) несёт
 * время БЕЗ пояса — `2026-10-27T08:43:00`, и это UTC: бэкенд работает в Docker, где пояс UTC.
 * Браузер читает такую строку как местное время — в истории было 08:43 вместо 11:43 (#21 п. 2).
 * В обратную сторону — то же: фильтр, отправленный местным временем без пояса, сравнивался
 * с UTC, и «1 ч» не находил свежих записей журнала (#17).
 *
 * Строка с поясом (`Z`, `+03:00`) читается как есть — так приходит журнал действий и архив.
 * Когда бэкенд начнёт везде отдавать пояс (docs/contract/2026-11-04-server-time-zone-contract.md),
 * `parseServerTime` продолжит работать, а `toServerTime` можно будет заменить на `toISOString`.
 */

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Время с сервера: с поясом — как есть, без пояса — как UTC. */
export function parseServerTime(value: string): Date {
  const s = value.trim();
  return new Date(HAS_ZONE.test(s) ? s : `${s}Z`);
}

/** Время UTC без пояса (`YYYY-MM-DDTHH:mm:ss`) — для параметров, которые бэкенд ждёт так. */
export function toServerTime(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/** Дата и время с сервера по-русски в местном поясе; нераспознанная строка — как есть. */
export function formatServerTime(value: string, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  const d = parseServerTime(value);
  if (Number.isNaN(d.getTime())) return value;
  return options
    ? d.toLocaleString("ru-RU", options)
    : `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU")}`;
}
