import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId} from "@/lib/editorHistoryProxy";

/** Повторная отправка сохранённого набора в automation (ответ бэкенда — 202). */
export const POST = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/automation/republish`, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`},
  });
  const text = await response.text().catch(() => "");
  return new NextResponse(text || null, {status: response.status});
});
