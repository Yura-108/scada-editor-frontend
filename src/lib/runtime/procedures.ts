import type {ProcedureResumeGuess, ProcedureStatus} from "@/types/recipe.types";

/**
 * Клиент шести ручек управления процедурой.
 *
 * Значения набора server-authoritative: наружу уходят только `recipeId` и `sessionId` —
 * произвольные уставки с клиента бэкенд не принимает.
 */

const base = (recipeId: string) => `/api/runtime/recipes/${encodeURIComponent(recipeId)}`;

/** Ответ бэкенда, когда активной процедуры для пары (сессия, рецепт) нет. */
export class NoActiveProcedureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoActiveProcedureError";
  }
}

const messageOf = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const raw = body as {message?: unknown; error?: unknown} | null;
  const message = raw?.message ?? raw?.error;
  return typeof message === "string" && message ? message : fallback;
};

/**
 * 400 у `/status` означает не сбой, а «процедуры нет в памяти рантайма» — например, его
 * перезапустили. Отдаём это отдельным типом, чтобы вызывающий предложил восстановление
 * через `resume-guess` + `jump`, а не показал оператору красную ошибку.
 */
async function readStatus(res: Response, fallback: string): Promise<ProcedureStatus> {
  if (res.status === 400) throw new NoActiveProcedureError(await messageOf(res, fallback));
  if (!res.ok) throw new Error(await messageOf(res, fallback));
  return res.json();
}

const post = (recipeId: string, op: string, body: Record<string, unknown>) =>
  fetch(`${base(recipeId)}/${op}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });

export async function startProcedure(recipeId: string, sessionId: string): Promise<ProcedureStatus> {
  return readStatus(await post(recipeId, "start", {sessionId}), "Не удалось запустить процедуру");
}

export async function confirmStep(recipeId: string, sessionId: string): Promise<ProcedureStatus> {
  return readStatus(await post(recipeId, "confirm", {sessionId}), "Не удалось подтвердить шаг");
}

export async function jumpToStep(
  recipeId: string,
  sessionId: string,
  stepIndex: number,
): Promise<ProcedureStatus> {
  return readStatus(
    await post(recipeId, "jump", {sessionId, stepIndex}),
    "Не удалось перейти на шаг",
  );
}

export async function fetchProcedureStatus(
  recipeId: string,
  sessionId: string,
): Promise<ProcedureStatus> {
  const res = await fetch(`${base(recipeId)}/status?sessionId=${encodeURIComponent(sessionId)}`);
  return readStatus(res, "Не удалось получить состояние процедуры");
}

/** Прерывание несуществующей процедуры бэкенд считает нормой — отдельной обработки не нужно. */
export async function abortProcedure(recipeId: string, sessionId: string): Promise<void> {
  const res = await post(recipeId, "abort", {sessionId});
  if (!res.ok) throw new Error(await messageOf(res, "Не удалось прервать процедуру"));
}

/**
 * Подсказка, на каком шаге процедура вероятно остановилась. Ничего не меняет.
 *
 * Ошибается на шагах, где условие завязано на время или подтверждение (`elapsedMs`
 * и `confirmed` после перезапуска не восстановить), поэтому решение всегда за оператором.
 */
export async function fetchResumeGuess(
  recipeId: string,
  sessionId: string,
): Promise<ProcedureResumeGuess> {
  const res = await fetch(
    `${base(recipeId)}/resume-guess?sessionId=${encodeURIComponent(sessionId)}`,
  );
  if (!res.ok) throw new Error(await messageOf(res, "Не удалось получить подсказку"));
  return res.json();
}
