import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {
  badRecipeId, missingSessionId, parseRecipeId, parseSessionId, proxyProcedure,
} from "@/lib/procedureProxy";

/** Прерывание несуществующей процедуры бэкенд считает нормой и тоже отвечает 200. */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseRecipeId(params.id);
  if (!id) return badRecipeId();

  const body = await req.json().catch(() => null);
  const sessionId = parseSessionId((body as {sessionId?: unknown} | null)?.sessionId);
  if (!sessionId) return missingSessionId();

  return proxyProcedure(`/api/runtime/recipes/${encodeURIComponent(id)}/abort`, token, {
    method: "POST",
    body: {sessionId},
  });
});
