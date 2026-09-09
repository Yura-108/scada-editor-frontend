import {NextResponse} from "next/server";

/**
 * Общая часть шести прокси-роутов управления процедурой
 * (`/api/runtime/recipes/{id}/{start|status|confirm|jump|abort|resume-guess}`).
 *
 * REST рантайма идёт через gateway — тот же адрес, что у сессий мониторинга.
 */
export const RUNTIME_BACKEND_URL =
  process.env.BACKEND_URL_RUNTIME || process.env.BACKEND_URL || "http://localhost:8080";

/**
 * `id` рецепта — слаг, подставляемый в путь запроса к бэкенду. Пропускаем только
 * юникодные буквы, цифры, `_` и `-`: слаг строится из русского имени, а точки и слеши
 * в пути делать нечего.
 */
const ID_PATTERN = /^[\p{L}\p{N}_-]+$/u;

export const parseRecipeId = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 && raw.length <= 200 && ID_PATTERN.test(raw)
    ? raw
    : null;

export const badRecipeId = () =>
  NextResponse.json({message: "Недопустимый идентификатор рецепта"}, {status: 400});

/** Непустой `sessionId` — его требует любая из шести ручек. */
export const parseSessionId = (raw: unknown): string | null => {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value ? value : null;
};

export const missingSessionId = () =>
  NextResponse.json({message: "Параметр sessionId обязателен"}, {status: 400});

/**
 * Прокси к рантайму с пробросом РЕАЛЬНОГО статуса.
 *
 * Пробрасывать обязательно: 400 от `/status` («нет активной процедуры») — это не сбой,
 * а штатный сигнал «рантайм перезапустили, состояние в памяти потеряно», по которому
 * панель показывает подсказку `resume-guess`. Превратив его в 500, мы бы сломали
 * восстановление процедуры.
 */
export async function proxyProcedure(
  path: string,
  token: string,
  init?: {method?: "GET" | "POST"; body?: unknown},
): Promise<NextResponse> {
  const method = init?.method ?? "GET";

  const response = await fetch(`${RUNTIME_BACKEND_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(init?.body !== undefined ? {body: JSON.stringify(init.body)} : {}),
  });

  // `abort` отвечает пустым телом — `json()` на нём падает, и это нормальный ответ.
  const text = await response.text().catch(() => "");
  if (!text) return new NextResponse(null, {status: response.status});

  return new NextResponse(text, {
    status: response.status,
    headers: {"Content-Type": response.headers.get("content-type") ?? "application/json"},
  });
}
