import {NextResponse} from "next/server";

/**
 * Общая часть пяти прокси-роутов управления процедурой
 * (`/api/runtime/recipes/{id}/{start|status|confirm|jump|abort}`).
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

/**
 * `projectId` — ключ процедуры, обязателен во всех ручках: мойка принадлежит проекту, а не
 * открытому экрану.
 */
export const parseProjectId = (raw: unknown): number | null => {
  const value = typeof raw === "string" ? Number(raw) : raw;
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
};

export const missingProjectId = () =>
  NextResponse.json(
    {message: "Параметр projectId обязателен и должен быть целым числом"},
    {status: 400},
  );

/**
 * `sessionId` необязателен — это лишь подпись «из какого экрана нажали». Пустую строку
 * подписью не считаем и на бэкенд не отправляем.
 */
export const parseSessionId = (raw: unknown): string | null => {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value ? value : null;
};

/**
 * Прокси к рантайму с пробросом РЕАЛЬНОГО статуса.
 *
 * Пробрасывать обязательно оба «нештатных» кода, и ни один из них не является сбоем:
 * 400 — «в проекте нет активной процедуры, её ещё не запускали»; 409 — состояние не
 * позволяет (процедура уже идёт, проект не в эксплуатации), и в теле приезжает текущий
 * статус, который панель показывает оператору. Превратив их в 500, мы бы показали красную
 * ошибку там, где надо показать, на каком шаге мойка.
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
