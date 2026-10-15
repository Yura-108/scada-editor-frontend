import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Уровни операций процедур проекта (черновик): `GET` — view или edit, `PUT` — edit.
 * `{start, confirm, pause, resume, jump, abort}`, каждое 1…10 или null (= 1); `PUT` заменяет
 * все шесть и отвечает сохранённым набором. До монитора доезжают только с новым prod.
 */
const levelsUrl = (projectId: number) =>
  `${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/procedure-levels`;

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(levelsUrl(projectId), {
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThrough(response);
});

export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({message: "Пустое тело запроса"}, {status: 400});
  }
  const response = await fetch(levelsUrl(projectId), {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  return passThrough(response);
});
