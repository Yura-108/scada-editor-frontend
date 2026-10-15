import type {AccessDenial, DenyReason} from "@/types/access.types";

/**
 * Отказы в доступе. Бэкенд (editor, runtime, channel, auth) отвечает одинаково:
 * `403 {error: "FORBIDDEN", reason, requiredLevel?}`, а `NO_USER` — тем же телом с 401.
 * Поля `message` в таком теле нет, поэтому без перевода тост показывал сырой JSON.
 */

const REASON_TEXT: Record<DenyReason, string> = {
  NO_USER: "Сеанс истёк — войдите заново",
  NO_PROJECT_ACCESS: "Нет доступа к проекту",
  NO_OPERATE: "Нет права управления",
  NO_EDIT: "Только просмотр — сохранение недоступно",
  LEVEL_TOO_LOW: "Недостаточный уровень доступа",
  PATH_NOT_ALLOWED: "Нет доступа к этой ветке базы каналов",
  NOT_ADMIN: "Только для администратора",
  USER_DISABLED: "Учётная запись отключена",
  ACCESS_NOT_READY: "Сервер запускается, повторите через несколько секунд",
};

export const isAccessDenial = (body: unknown): body is AccessDenial =>
  !!body
  && typeof body === "object"
  && (body as {error?: unknown}).error === "FORBIDDEN"
  && typeof (body as {reason?: unknown}).reason === "string";

/** «Нужен уровень доступа N» — общая подпись для кнопок и отказов. */
export const levelRequiredText = (level: number) => `Нужен уровень доступа ${level}`;

/** Текст отказа по `reason`; неизвестная причина — как есть. */
export const describeDenial = (denial: {reason: string; requiredLevel?: number | null}): string => {
  if (denial.reason === "LEVEL_TOO_LOW" && typeof denial.requiredLevel === "number") {
    return levelRequiredText(denial.requiredLevel);
  }
  return REASON_TEXT[denial.reason as DenyReason] ?? `Доступ запрещён (${denial.reason})`;
};

/** Сервер ещё не загрузил права после рестарта: это не отказ, запрос надо повторить. */
export const isAccessNotReady = (body: unknown): boolean =>
  isAccessDenial(body) && body.reason === "ACCESS_NOT_READY";

/**
 * Человеческий текст ошибки по телу ответа: отказ в доступе → по `reason`,
 * иначе Spring-`message`, иначе статус и начало тела.
 */
export const errorTextFromBody = (status: number, text: string): string => {
  try {
    const parsed = JSON.parse(text);
    if (isAccessDenial(parsed)) return describeDenial(parsed);
    if (typeof parsed?.message === "string" && parsed.message) return parsed.message;
  } catch {
    // тело не JSON — покажем как есть (обрезано)
  }
  return `Ошибка ${status}${text ? `: ${text.slice(0, 200)}` : ""}`;
};

/** То же для `Response`; тело читается, так что ответ дальше использовать нельзя. */
export const readBackendError = async (res: Response): Promise<string> =>
  errorTextFromBody(res.status, await res.text().catch(() => ""));

/** Для уже разобранного JSON-тела (`data?.message ?? …` в старых местах). */
export const errorTextFromJson = (status: number, data: unknown, fallback?: string): string => {
  if (isAccessDenial(data)) return describeDenial(data);
  const message = (data as {message?: unknown} | null)?.message;
  if (typeof message === "string" && message) return message;
  return fallback ?? `Ошибка ${status}`;
};
