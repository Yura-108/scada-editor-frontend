import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Запись `image` проекта: `PUT /api/editor/projects/{projectId}/image {image}` → `{image}`
 * (docs/contract/2026-09-30-project-image-contract.md). Непрозрачный JSON — сейчас там общие
 * закреплённые схемы. Читается он не здесь, а в списке проектов (`/api/editor/projects`).
 * Статус бэкенда — как есть: 404/405 значит «бэк ещё не умеет», и клиент остаётся на localStorage.
 */
export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const body = await req.json().catch(() => null) as {image?: unknown} | null;
  const image = body?.image;
  if (typeof image !== "object" || image === null || Array.isArray(image)) {
    return NextResponse.json({message: "image должен быть объектом"}, {status: 400});
  }
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/image`, {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({image}),
  });
  return passThrough(response);
});
