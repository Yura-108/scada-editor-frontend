import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";

// Как и создание рантайм-сессии: REST идёт через gateway, не напрямую на :8085.
const BACKEND_URL = process.env.BACKEND_URL_RUNTIME || process.env.BACKEND_URL || "http://localhost:8080";

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null);
  const recipeId = Number(body?.recipeId);

  if (!Number.isSafeInteger(recipeId)) {
    return NextResponse.json(
      {error: "Параметр recipeId обязателен и должен быть целым числом"},
      {status: 400},
    );
  }

  // sessionId нужен, чтобы локальные (без тега) строки записались в сессию —
  // без него теговые строки применятся, а локальные попадут в failedRows.
  // Таймаут больше клиентского (20с) — BFF не должен обрывать запрос раньше,
  // чем успеет ответить сам бэкенд (дедлайн подтверждения брокера ~7с + резолв).
  const response = await fetch(`${BACKEND_URL}/api/runtime/recipes/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({recipeId, sessionId: body?.sessionId, projectId: body?.projectId}),
    signal: AbortSignal.timeout(25_000),
  });

  const data = await response.json().catch(() => null);

  // Пробрасываем реальный статус бэкенда — фронт различает частичный успех (failed>0) от 4xx/5xx.
  return NextResponse.json(data, {status: response.status});
});
