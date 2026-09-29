import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId} from "@/lib/editorHistoryProxy";
import {RUNTIME_BACKEND_URL} from "@/lib/procedureProxy";
import {passThroughRelease} from "@/lib/releaseProxy";

/**
 * Схемы prod-выпуска проекта — то, что рисует монитор: `[{id, name, project_id}]` и заголовок
 * `X-Release-Version`. 409 — проект не в эксплуатации.
 */
export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${RUNTIME_BACKEND_URL}/api/runtime/projects/${projectId}/scenes`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThroughRelease(response);
});
