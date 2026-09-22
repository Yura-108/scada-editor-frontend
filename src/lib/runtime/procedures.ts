import type {ProcedureStatus} from "@/types/recipe.types";

/**
 * Клиент пяти ручек управления процедурой.
 *
 * Процедура адресуется **проектом**: мойка принадлежит объекту, а не открытому экрану, и
 * обязана идти, когда оператор закрыл браузер. `sessionId` необязателен и служит ровно одним —
 * подписью «из какого экрана нажали», которая уходит остальным наблюдателям в событии. Прав на
 * процедуру он не даёт: подтвердить или прервать может любой оператор.
 *
 * Значения набора server-authoritative: произвольные уставки с клиента бэкенд не принимает.
 */

const base = (recipeId: string) => `/api/runtime/recipes/${encodeURIComponent(recipeId)}`;

/** В проекте нет активной процедуры — её ещё не запускали (400 от бэкенда). */
export class NoActiveProcedureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoActiveProcedureError";
  }
}

/**
 * 409: запрос корректен, но состояние не позволяет его выполнить — процедура уже идёт, шаг
 * на экране разошёлся с текущим, либо проект не в эксплуатации.
 *
 * В первых двух случаях тело несёт текущий статус (`procedure`), и это важнее текста ошибки:
 * повторный «Запустить» на идущей мойке — повод показать, на каком она шаге, а не красный тост.
 */
export class ProcedureConflictError extends Error {
  constructor(
    message: string,
    readonly procedure: ProcedureStatus | null,
  ) {
    super(message);
    this.name = "ProcedureConflictError";
  }
}

const messageOf = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const raw = body as {message?: unknown; error?: unknown} | null;
  const message = raw?.message ?? raw?.error;
  return typeof message === "string" && message ? message : fallback;
};

async function readStatus(res: Response, fallback: string): Promise<ProcedureStatus> {
  if (res.status === 400) throw new NoActiveProcedureError(await messageOf(res, fallback));
  if (res.status === 409) {
    // Тело читаем один раз: здесь нужен и текст, и вложенный статус.
    const body = await res.json().catch(() => null);
    const raw = body as {message?: unknown; procedure?: unknown} | null;
    const message = typeof raw?.message === "string" && raw.message ? raw.message : fallback;
    throw new ProcedureConflictError(message, (raw?.procedure as ProcedureStatus) ?? null);
  }
  if (!res.ok) throw new Error(await messageOf(res, fallback));
  return res.json();
}

/** `sessionId` кладём в тело только когда он есть — пустая строка подписью не является. */
const body = (projectId: number, sessionId?: string, extra?: Record<string, unknown>) => ({
  projectId,
  ...(sessionId ? {sessionId} : {}),
  ...extra,
});

const post = (recipeId: string, op: string, payload: Record<string, unknown>) =>
  fetch(`${base(recipeId)}/${op}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });

export async function startProcedure(
  recipeId: string,
  projectId: number,
  sessionId?: string,
): Promise<ProcedureStatus> {
  return readStatus(
    await post(recipeId, "start", body(projectId, sessionId)),
    "Не удалось запустить процедуру",
  );
}

/**
 * `stepIndex` бэкенд принимает, но необязателен, и мы его не шлём: страховка от «два оператора
 * подтвердили одновременно» стоила бы отдельной ветки 409 ради случая, который на практике
 * не совпадёт. Без него подтверждается текущий шаг.
 */
export async function confirmStep(
  recipeId: string,
  projectId: number,
  sessionId?: string,
): Promise<ProcedureStatus> {
  return readStatus(
    await post(recipeId, "confirm", body(projectId, sessionId)),
    "Не удалось подтвердить шаг",
  );
}

export async function jumpToStep(
  recipeId: string,
  projectId: number,
  stepIndex: number,
  sessionId?: string,
): Promise<ProcedureStatus> {
  return readStatus(
    await post(recipeId, "jump", body(projectId, sessionId, {stepIndex})),
    "Не удалось перейти на шаг",
  );
}

export async function fetchProcedureStatus(
  recipeId: string,
  projectId: number,
): Promise<ProcedureStatus> {
  const res = await fetch(`${base(recipeId)}/status?projectId=${projectId}`);
  return readStatus(res, "Не удалось получить состояние процедуры");
}

/** Прерывание несуществующей процедуры бэкенд считает нормой — отдельной обработки не нужно. */
export async function abortProcedure(
  recipeId: string,
  projectId: number,
  sessionId?: string,
): Promise<void> {
  const res = await post(recipeId, "abort", body(projectId, sessionId));
  if (!res.ok) throw new Error(await messageOf(res, "Не удалось прервать процедуру"));
}
