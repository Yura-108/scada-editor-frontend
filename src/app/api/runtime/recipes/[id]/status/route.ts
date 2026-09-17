import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {
  badRecipeId, missingProjectId, parseProjectId, parseRecipeId, proxyProcedure,
} from "@/lib/procedureProxy";

export const GET = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseRecipeId(params.id);
  if (!id) return badRecipeId();

  const projectId = parseProjectId(req.nextUrl.searchParams.get("projectId"));
  if (projectId === null) return missingProjectId();

  return proxyProcedure(
    `/api/runtime/recipes/${encodeURIComponent(id)}/status?projectId=${projectId}`,
    token,
  );
});
