import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Процедурные рецепты проекта (черновик): `GET` — view или edit, `POST` — edit
 * (`docs/contract/2026-10-19-recipes-in-project-contract.md`). До мойки рецепт доезжает
 * только с новым prod-выпуском.
 *
 * Тело ошибки бэкенда отдаём как есть: у 400-х здесь осмысленный `message`
 * («action references tag(s) not declared in manifest 'tags': [FOO]»), у 403 —
 * `{error: "FORBIDDEN", reason}`, который переводит клиент. `X-Username` проставляет gateway.
 */
const recipesUrl = (projectId: number) =>
  `${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/recipes`;

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(recipesUrl(projectId), {
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThrough(response);
});

export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({message: "Рецепт пуст!"}, {status: 400});
  }
  const response = await fetch(recipesUrl(projectId), {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  return passThrough(response);
});
