import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {
  badRecipeId, missingProjectId, parseProjectId, parseRecipeId, parseSessionId, proxyProcedure,
} from "@/lib/procedureProxy";

/**
 * Снятие паузы. Пока авария активна, бэкенд отвечает 409 с её текстом и текущим статусом —
 * `proxyProcedure` пробрасывает и код, и тело, чтобы панель показала причину, а не «ошибку».
 */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseRecipeId(params.id);
  if (!id) return badRecipeId();

  const raw = (await req.json().catch(() => null)) as
    {projectId?: unknown; sessionId?: unknown} | null;

  const projectId = parseProjectId(raw?.projectId);
  if (projectId === null) return missingProjectId();

  const sessionId = parseSessionId(raw?.sessionId);

  return proxyProcedure(`/api/runtime/recipes/${encodeURIComponent(id)}/resume`, token, {
    method: "POST",
    body: {projectId, ...(sessionId ? {sessionId} : {})},
  });
});
