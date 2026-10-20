import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Один рецепт проекта: `GET` — view или edit, `PUT`/`DELETE` — edit.
 *
 * `id` — слаг имени, обычно кириллица: Next отдаёт параметр уже раскодированным, поэтому
 * в адрес бэкенда он идёт снова через `encodeURIComponent`.
 */
const recipeUrl = (projectId: number, id: string) =>
  `${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/recipes/${encodeURIComponent(id)}`;

const parsePath = (params: Record<string, string>) => {
  const projectId = parseId(params.projectId);
  const id = typeof params.id === "string" && params.id ? params.id : null;
  return {projectId, id};
};

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const {projectId, id} = parsePath(params);
  if (projectId === null || id === null) return badPath("Неверный адрес рецепта");
  const response = await fetch(recipeUrl(projectId, id), {
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThrough(response);
});

export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const {projectId, id} = parsePath(params);
  if (projectId === null || id === null) return badPath("Неверный адрес рецепта");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({message: "Рецепт пуст!"}, {status: 400});
  }
  const response = await fetch(recipeUrl(projectId, id), {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  return passThrough(response);
});

export const DELETE = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const {projectId, id} = parsePath(params);
  if (projectId === null || id === null) return badPath("Неверный адрес рецепта");
  const response = await fetch(recipeUrl(projectId, id), {
    method: "DELETE",
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThrough(response);
});
