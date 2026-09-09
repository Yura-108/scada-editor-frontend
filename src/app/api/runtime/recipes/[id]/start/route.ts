import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {
  badRecipeId, missingSessionId, parseRecipeId, parseSessionId, proxyProcedure,
} from "@/lib/procedureProxy";

export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseRecipeId(params.id);
  if (!id) return badRecipeId();

  const body = await req.json().catch(() => null);
  const sessionId = parseSessionId((body as {sessionId?: unknown} | null)?.sessionId);
  if (!sessionId) return missingSessionId();

  return proxyProcedure(`/api/runtime/recipes/${encodeURIComponent(id)}/start`, token, {
    method: "POST",
    body: {sessionId},
  });
});
