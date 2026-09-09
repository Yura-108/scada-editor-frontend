import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {
  badRecipeId, missingSessionId, parseRecipeId, parseSessionId, proxyProcedure,
} from "@/lib/procedureProxy";

export const GET = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseRecipeId(params.id);
  if (!id) return badRecipeId();

  const sessionId = parseSessionId(req.nextUrl.searchParams.get("sessionId"));
  if (!sessionId) return missingSessionId();

  return proxyProcedure(
    `/api/runtime/recipes/${encodeURIComponent(id)}/resume-guess?sessionId=${encodeURIComponent(sessionId)}`,
    token,
  );
});
