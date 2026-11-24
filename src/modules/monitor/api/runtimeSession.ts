import {describeDenial, isAccessDenial, isAccessNotReady} from "@/core/access";
import type {AccessDenial} from "@/core/access";

/** Сервер ещё грузит права после рестарта — повторяем не раньше чем через столько. */
export const ACCESS_NOT_READY_DELAY_MS = 4_000;

/**
 * Исход создания рантайм-сессии (`POST /api/runtime/sessions`).
 *
 * - `ok` — сессия создана: путь WS на gateway и одноразовый билет к нему;
 * - `rejected` — окончательный отказ, повтор ничего не изменит (`state` — 409, проект не в
 *   эксплуатации или не назначен экземпляру; `access` — 403 по правам);
 * - `retry` — временно (`unavailable` — 503, экземпляр недоступен; `access-not-ready` — права
 *   ещё грузятся), повторять с паузой не меньше `minDelay`.
 *
 * Сетевая ошибка, иной код или ответ без `wsPath`/`ticket` — исключение: его вызывающий
 * повторяет обычным переподключением.
 */
export type RuntimeSessionOutcome =
  | {kind: "ok"; wsPath: string; ticket: string; sessionId: string | null; rawSessionId: unknown; versionNo?: number}
  | {kind: "rejected"; reason: "state" | "access"; message: string}
  | {kind: "retry"; reason: "unavailable" | "access-not-ready"; detail: string; minDelay: number};

/** Причина отказа из тела ответа рантайма: у него это всегда поле `message`. */
const messageOf = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const message = (body as {message?: unknown} | null)?.message;
  return typeof message === "string" && message ? message : fallback;
};

/** Новая сессия наблюдателя проекта: каждый (ре)коннект начинается с неё. */
export async function createRuntimeSession(projectId: number): Promise<RuntimeSessionOutcome> {
  const res = await fetch("/api/runtime/sessions", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({projectId}),
  });

  // 409 — состояние, а не сбой связи: проект не введён в эксплуатацию либо не назначен
  // ни одному экземпляру runtime. Повторные попытки ничего не изменят, пока человек не
  // выставит флаг или не раздаст назначение, поэтому реконнект не запускаем. Разные 409
  // различаются только текстом — показываем его как есть, не подменяя своим.
  if (res.status === 409) {
    return {kind: "rejected", reason: "state", message: await messageOf(res, "Проект недоступен для мониторинга")};
  }

  // 503 — экземпляр, на котором работает проект, недоступен или неизвестен. В отличие
  // от 409 это временно: экземпляр могут поднять, и проект подхватится сам. Повторяем
  // с обычной паузой, но с причиной на экране — без неё оператор видит голое
  // «Переподключение…» и не понимает, что чинить не у него.
  if (res.status === 503) {
    return {kind: "retry", reason: "unavailable", detail: await messageOf(res, "Сервер исполнения недоступен"), minDelay: 0};
  }

  // 403 — права. ACCESS_NOT_READY — сервер ещё грузит их после рестарта: повторяем с
  // паузой. Любая другая причина окончательна, как и 409: повтор её не изменит.
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    if (isAccessNotReady(body)) {
      return {
        kind: "retry", reason: "access-not-ready",
        detail: describeDenial(body as AccessDenial), minDelay: ACCESS_NOT_READY_DELAY_MS,
      };
    }
    return {kind: "rejected", reason: "access", message: isAccessDenial(body) ? describeDenial(body) : "Нет доступа к проекту"};
  }

  if (!res.ok) throw new Error(`POST /api/runtime/sessions → ${res.status}`);

  const data = await res.json();

  if (typeof data?.wsPath !== "string") throw new Error("В ответе сессии нет wsPath");
  if (typeof data?.ticket !== "string") throw new Error("В ответе сессии нет ticket");

  return {
    kind: "ok",
    wsPath: data.wsPath,
    ticket: data.ticket,
    sessionId: typeof data?.sessionId === "string" ? data.sessionId : null,
    rawSessionId: data.sessionId,
    versionNo: typeof data?.versionNo === "number" ? data.versionNo : undefined,
  };
}

/**
 * Best-effort снятие наблюдателя. Не ждём ответа (не блокируем закрытие сокета и уход со
 * страницы), `keepalive` переживает unload; ошибка ничего не ломает на клиенте.
 */
export function deleteRuntimeSession(sessionId: string) {
  fetch(`/api/runtime/sessions/${sessionId}`, {method: "DELETE", keepalive: true}).catch(() => {});
}
