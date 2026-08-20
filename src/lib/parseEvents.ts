import {ElementEventEntry, ElementEventName, ElementEvents, PropertyRef} from "@/types/binding.types";

const EVENT_NAMES = new Set<string>(["onClick", "onDoubleClick"]);

/** Конверт обработчика с propertyRefs, запакованный JSON-строкой в `script` (симметрия с TagBinding). */
const isEnvelopedHandler = (raw: unknown): raw is {v: 1; code: string; propertyRefs?: PropertyRef[]} =>
  typeof raw === "object" && raw !== null &&
  (raw as {v?: unknown}).v === 1 && typeof (raw as {code?: unknown}).code === "string";

/**
 * Восстанавливает ElementEvents из DTO-массива бэкенда `{id?, event_type, script}[]`.
 * `script` — либо сырой JS (как в примере бэкенда), либо наш JSON-конверт
 * `{v:1, code, propertyRefs}` (когда обработчик ссылается на свойства других
 * компонентов). Нераспознанное — пропускаем.
 *
 * `id` запоминаем в `serverId`, чтобы вернуть его следующим сохранением как получили
 * (§2 контракта версий).
 */
export const parseEvents = (raw: unknown): ElementEvents => {
  if (!Array.isArray(raw)) return [];

  const result: ElementEventEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const eventType = (item as {event_type?: unknown}).event_type;
    if (typeof eventType !== "string" || !EVENT_NAMES.has(eventType)) continue;
    const script = (item as {script?: unknown}).script;
    if (typeof script !== "string" || !script) continue;

    let code = script;
    let propertyRefs: PropertyRef[] | undefined;
    try {
      const parsed = JSON.parse(script);
      if (isEnvelopedHandler(parsed)) {
        code = parsed.code;
        propertyRefs = parsed.propertyRefs;
      }
    } catch {
      // не JSON — сырой код, используем как есть
    }
    const serverId = (item as {id?: unknown}).id;
    result.push({
      event_type: eventType as ElementEventName,
      handler: {code, propertyRefs},
      ...(typeof serverId === "number" || typeof serverId === "string" ? {serverId} : {}),
    });
  }
  return result;
};
