import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {
  badRecipeId, missingSessionId, parseRecipeId, parseSessionId, proxyProcedure,
} from "@/lib/procedureProxy";

/**
 * Ручной выбор/восстановление шага.
 *
 * `jump` НЕ требует предварительного `/start`: если активной процедуры для пары
 * (sessionId, recipeId) ещё нет, бэкенд создаёт её и сразу входит в указанный шаг —
 * ровно то, что нужно после перезапуска рантайма.
 */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseRecipeId(params.id);
  if (!id) return badRecipeId();

  const body = await req.json().catch(() => null);
  const raw = body as {sessionId?: unknown; stepIndex?: unknown} | null;

  const sessionId = parseSessionId(raw?.sessionId);
  if (!sessionId) return missingSessionId();

  // Проверяем здесь, а не только на бэкенде: пропущенный `stepIndex` уехал бы как
  // `undefined` и молча означал бы прыжок на шаг 0 — то есть перезапуск процедуры
  // с начала вместо восстановления на нужном месте.
  const stepIndex = Number(raw?.stepIndex);
  if (!Number.isSafeInteger(stepIndex) || stepIndex < 0) {
    return NextResponse.json(
      {message: "Параметр stepIndex обязателен и должен быть целым числом не меньше нуля"},
      {status: 400},
    );
  }

  return proxyProcedure(`/api/runtime/recipes/${encodeURIComponent(id)}/jump`, token, {
    method: "POST",
    body: {sessionId, stepIndex},
  });
});
