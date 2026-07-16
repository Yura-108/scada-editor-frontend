import {TagBinding} from "@/types/binding.types";

/** Уже развёрнутый TagBinding (сырые объекты из composition-дескрипторов). */
const isTagBinding = (raw: unknown): raw is TagBinding =>
  typeof raw === "object" && raw !== null &&
  (raw as TagBinding).v === 1 &&
  typeof (raw as TagBinding).code === "string";

/**
 * Восстанавливает TagBinding[] из обеих форм сериализации:
 *  - сырые объекты (запечены в `states[].image.composition[].bindings` как есть);
 *  - DTO-обёртки `{component_property_id, name, script}` с JSON внутри `script`
 *    (top-level биндинги компонента едут через контракт бэкенда).
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
          result.push(parsed);
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
