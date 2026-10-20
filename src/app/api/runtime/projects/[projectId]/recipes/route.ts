import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId} from "@/lib/editorHistoryProxy";
import {RUNTIME_BACKEND_URL} from "@/lib/procedureProxy";
import {passThroughRelease} from "@/lib/releaseProxy";

/**
 * Рецепты prod-выпуска — ровно те, что исполнит процедура. Доступен всем, кто видит монитор
 * (в том числе оператору с одним «управлением», которому редакторские пути отвечают 403).
 * 409 — проект не в эксплуатации. `X-Release-Version` — выпуск, из которого список.
 */
export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${RUNTIME_BACKEND_URL}/api/runtime/projects/${projectId}/recipes`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThroughRelease(response);
});
