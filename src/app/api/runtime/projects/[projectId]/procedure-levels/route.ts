import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId} from "@/lib/editorHistoryProxy";
import {RUNTIME_BACKEND_URL} from "@/lib/procedureProxy";
import {passThroughRelease} from "@/lib/releaseProxy";

/**
 * Уровни операций процедур из prod-выпуска — по ним сервер проверяет кнопки процедур.
 * Доступен всем, кто видит монитор (в том числе оператору с одним «управлением»).
 * 409 — проект не в эксплуатации. `X-Release-Version` — выпуск, из которого уровни.
 */
export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${RUNTIME_BACKEND_URL}/api/runtime/projects/${projectId}/procedure-levels`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThroughRelease(response);
});
