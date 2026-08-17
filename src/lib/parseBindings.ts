import {TagBinding} from "@/types/binding.types";

/** Уже развёрнутый TagBinding (сырые объекты из composition-дескрипторов). */
const isTagBinding = (raw: unknown): raw is TagBinding =>
  typeof raw === "object" && raw !== null &&
  (raw as TagBinding).v === 1 &&
  typeof (raw as TagBinding).code === "string";

/**
 * Серверные поля DTO-обёртки, которые надо вернуть в следующем сохранении как получили
 * (§2 контракта версий): id самого биндинга и пара «свойство» — номер плюс имя.
 *
 * Живут на TagBinding отдельными полями, а не внутри опак-строки `script`: строку мы
 * пересобираем при каждом сохранении, и id из старого JSON пережил бы удаление сущности
 * на сервере — после восстановления версии мы бы вернули номер, которого уже нет.
 */
const serverFieldsOf = (item: unknown): Partial<TagBinding> => {
  if (typeof item !== "object" || item === null) return {};

  const dto = item as {
    id?: unknown;
    component_property_id?: unknown;
    component_property_name?: unknown;
  };

  return {
    ...(typeof dto.id === "number" || typeof dto.id === "string" ? {serverId: dto.id} : {}),
    ...(typeof dto.component_property_id === "number"
      ? {componentPropertyId: dto.component_property_id}
      : {}),
    ...(typeof dto.component_property_name === "string"
      ? {componentPropertyName: dto.component_property_name}
      : {}),
  };
};

/**
 * Восстанавливает TagBinding[] из обеих форм сериализации:
 *  - сырые объекты (запечены в `states[].image.composition[].bindings` как есть);
 *  - DTO-обёртки `{id?, component_property_id, component_property_name?, name, script}`
 *    с JSON внутри `script` (top-level биндинги компонента едут через контракт бэкенда).
 * Всё, что не распознано (легаси/мусор), отбрасывается с предупреждением.
 */
export const parseBindings = (raw: unknown): TagBinding[] => {
  if (!Array.isArray(raw)) return [];

  const result: TagBinding[] = [];
  for (const item of raw) {
    if (isTagBinding(item)) {
      result.push(item);
      continue;
    }

    const script = typeof item === "object" && item !== null
      ? (item as {script?: unknown}).script
      : undefined;
    if (typeof script === "string" && script) {
      try {
        const parsed = JSON.parse(script);
        if (isTagBinding(parsed)) {
          // Серверные поля берём из обёртки, а не из JSON: обёртка — то, что сервер
          // прислал сейчас, JSON — то, что мы сохранили в прошлый раз.
          result.push({...parsed, ...serverFieldsOf(item)});
          continue;
        }
      } catch {
        // не JSON — легаси-содержимое, отбрасываем ниже
      }
    }

    console.warn("parseBindings: пропущен нераспознанный биндинг", item);
  }
  return result;
};
