import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Сделать выпуск prod: `PUT /api/editor/projects/{id}/runtime/prod {versionNo}`. Работающий
 * проект переключается сам, мониторы получают кадр `TREE_CHANGED`.
 */
export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const body = await req.json().catch(() => null) as {versionNo?: unknown} | null;
  const versionNo = body?.versionNo;
  if (typeof versionNo !== "number" || !Number.isSafeInteger(versionNo) || versionNo < 1) {
    return NextResponse.json({message: "versionNo обязателен и должен быть целым положительным числом"}, {status: 400});
  }
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/runtime/prod`, {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({versionNo}),
  });
  return passThrough(response);
});
