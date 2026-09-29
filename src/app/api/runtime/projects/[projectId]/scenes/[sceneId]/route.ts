import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId} from "@/lib/editorHistoryProxy";
import {RUNTIME_BACKEND_URL} from "@/lib/procedureProxy";
import {passThroughRelease} from "@/lib/releaseProxy";

/**
 * Схема prod-выпуска — тот же объект компонента, что у редактора, плюс `X-Release-Version`.
 * 404 — схемы нет в выпуске; 409 — проект не в эксплуатации.
 */
export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  const sceneId = parseId(params.sceneId);
  if (projectId === null || sceneId === null) return badPath("Идентификаторы проекта и схемы должны быть целыми числами");
  const response = await fetch(
    `${RUNTIME_BACKEND_URL}/api/runtime/projects/${projectId}/scenes/${sceneId}`,
    {headers: {Authorization: `Bearer ${token}`}},
  );
  return passThroughRelease(response);
});
