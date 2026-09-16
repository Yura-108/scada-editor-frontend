import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {EDITOR_BACKEND_URL, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Палитра шаблонов задач автоматизации: `GET/POST /api/editor/automation-templates`.
 *
 * Палитра общая для всех проектов, поэтому путь вне `/projects/{projectId}`.
 * `X-Username` не передаём: истории у шаблонов нет, автора записывать некуда.
 */
const TEMPLATES_URL = `${EDITOR_BACKEND_URL}/api/editor/automation-templates`;

export const GET = protectedRoute(async (_req: NextRequest, {token}) => {
  const response = await fetch(TEMPLATES_URL, {
    method: "GET",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
  });
  return passThrough(response);
});

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({message: "Пустое тело запроса"}, {status: 400});
  const response = await fetch(TEMPLATES_URL, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  return passThrough(response);
});
