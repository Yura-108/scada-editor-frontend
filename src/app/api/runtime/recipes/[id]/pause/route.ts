import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {
  badRecipeId, missingProjectId, parseProjectId, parseRecipeId, parseSessionId, proxyProcedure,
} from "@/lib/procedureProxy";

/**
 * Пауза процедуры: оборудование переводится в `pause_action` рецепта, шаг не продвигается.
 * Рантайм ставит паузу и сам, пока активна авария, — эта ручка только для оператора.
 */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseRecipeId(params.id);
  if (!id) return badRecipeId();

  const raw = (await req.json().catch(() => null)) as
    {projectId?: unknown; sessionId?: unknown} | null;

  const projectId = parseProjectId(raw?.projectId);
  if (projectId === null) return missingProjectId();

  const sessionId = parseSessionId(raw?.sessionId);

  return proxyProcedure(`/api/runtime/recipes/${encodeURIComponent(id)}/pause`, token, {
    method: "POST",
    body: {projectId, ...(sessionId ? {sessionId} : {})},
  });
});
