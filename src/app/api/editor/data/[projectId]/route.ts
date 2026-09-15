import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId} from "@/lib/editorHistoryProxy";

/**
 * Таблицы данных проекта: `GET/PUT /api/editor/projects/{projectId}/data`.
 *
 * Ответ бэкенда отдаётся как есть: 400 project_data_invalid и 409 version_mismatch несут тело,
 * которое страница разбирает.
 */
const passThrough = async (response: Response) => {
  const text = await response.text().catch(() => "");
  return new NextResponse(text || null, {
    status: response.status,
    headers: {"Content-Type": response.headers.get("content-type") ?? "application/json"},
  });
};

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/data`, {
    method: "GET",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
  });
  return passThrough(response);
});

export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({message: "Пустое тело запроса"}, {status: 400});
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/data`, {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  return passThrough(response);
});
