import type {ProjectGrant} from "@/types/access.types";
import {levelRequiredText} from "@/lib/access/accessErrors";
import {DIRECT_WRITE_LEVEL, operateLevelOf, requiredLevelOf} from "@/lib/access/grants";

/**
 * Можно ли оператору запустить действие в мониторе. Сервер проверяет то же самое (по
 * prod-выпуску) и откажет сам — здесь только заранее гасим кнопку и объясняем почему.
 *
 * `null` — можно; строка — почему нельзя (подпись пункта меню / сообщение у кнопки).
 */
export const actionDenialText = (grant: ProjectGrant, requiredLevel: number | null | undefined): string | null => {
  if (!grant.operate) return "Нет права управления";
  const required = requiredLevelOf(requiredLevel);
  return operateLevelOf(grant) >= required ? null : levelRequiredText(required);
};

/** «Опции» и инспектор объекта пишут теги/свойства напрямую — это уровень ≥ 9 и «управление». */
export const canWriteDirectly = (grant: ProjectGrant): boolean =>
  grant.operate && operateLevelOf(grant) >= DIRECT_WRITE_LEVEL;
