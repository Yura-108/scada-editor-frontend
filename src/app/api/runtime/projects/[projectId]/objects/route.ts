import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId} from "@/lib/editorHistoryProxy";
import {RUNTIME_BACKEND_URL} from "@/lib/procedureProxy";
import {passThroughRelease} from "@/lib/releaseProxy";

/**
 * Объекты prod-выпуска со свойствами — список инспектора объектов монитора
 * (docs/contract/2026-10-01-object-inspector-contract.md): со всех сцен, по имени. Заголовок
 * `X-Release-Version` — выпуск, из которого собран список. 409 — проект не в эксплуатации.
 */
export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${RUNTIME_BACKEND_URL}/api/runtime/projects/${projectId}/objects`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThroughRelease(response);
});
