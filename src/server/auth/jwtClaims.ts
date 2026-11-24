/**
 * Клеймы JWT без проверки подписи: разбираем средний сегмент (base64url) сами —
 * новой зависимости на JWT-библиотеку не заводим. Подпись проверяет бэкенд; нам
 * клеймы нужны только для служебных вещей (имя пользователя, срок жизни cookie).
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}
