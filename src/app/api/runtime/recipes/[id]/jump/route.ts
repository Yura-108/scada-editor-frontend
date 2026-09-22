import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {
  badRecipeId, missingProjectId, parseProjectId, parseRecipeId, parseSessionId, proxyProcedure,
} from "@/lib/procedureProxy";

/**
 * Ручной выбор/восстановление шага.
 *
 * `jump` НЕ требует предварительного `/start`: если активной процедуры в проекте ещё нет,
 * бэкенд создаёт её и сразу входит в указанный шаг (`computeIfAbsent`) — это путь, которым
 * оператор ставит мойку на нужное место вручную.
 */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseRecipeId(params.id);
  if (!id) return badRecipeId();

  const raw = (await req.json().catch(() => null)) as
    {projectId?: unknown; sessionId?: unknown; stepIndex?: unknown} | null;

  const projectId = parseProjectId(raw?.projectId);
  if (projectId === null) return missingProjectId();

  const sessionId = parseSessionId(raw?.sessionId);

  // Проверяем здесь, а не только на бэкенде: пропущенный `stepIndex` уехал бы как
  // `undefined` и молча означал бы прыжок на шаг 0 — то есть перезапуск процедуры
  // с начала вместо перехода на нужное место.
  const stepIndex = Number(raw?.stepIndex);
  if (!Number.isSafeInteger(stepIndex) || stepIndex < 0) {
    return NextResponse.json(
      {message: "Параметр stepIndex обязателен и должен быть целым числом не меньше нуля"},
      {status: 400},
    );
  }

  return proxyProcedure(`/api/runtime/recipes/${encodeURIComponent(id)}/jump`, token, {
    method: "POST",
    body: {projectId, stepIndex, ...(sessionId ? {sessionId} : {})},
  });
});
