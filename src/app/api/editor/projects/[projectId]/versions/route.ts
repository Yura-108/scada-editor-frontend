import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Выпустить текущий черновик проекта: `POST {comment}` → `{version_no, created_at, comment,
 * unchanged}`. `unchanged: true` — дерево не менялось, бэкенд вернул прежний выпуск.
 *
 * Список выпусков — общим прокси истории (`/api/editor/history/projects/{id}/versions`): на
 * бэкенде у этого пути GET обслуживает общий контроллер версий, POST — контроллер выпусков.
 * `X-Username` проставляет gateway (бэкенд требует его обязательно).
 */
const url = (projectId: number) => `${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/versions`;

export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const body = await req.json().catch(() => null) as {comment?: unknown} | null;
  const comment = body?.comment;
  if (comment !== undefined && comment !== null && typeof comment !== "string") {
    return NextResponse.json({message: "comment должен быть строкой"}, {status: 400});
  }
  const response = await fetch(url(projectId), {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({comment: typeof comment === "string" ? comment.trim() : ""}),
  });
  return passThrough(response);
});
