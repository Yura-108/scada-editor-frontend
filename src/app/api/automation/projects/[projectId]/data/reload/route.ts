import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId} from "@/lib/editorHistoryProxy";

/** automation доступен через gateway (/api/automation/**). */
const AUTOMATION_BACKEND_URL =
  process.env.BACKEND_URL_AUTOMATION || process.env.BACKEND_URL || "http://localhost:8080";

/** Перечитать данные проекта в automation: 202 — принято, 404 — проект не исполняется. */
export const POST = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${AUTOMATION_BACKEND_URL}/api/automation/projects/${projectId}/data/reload`, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`},
  });
  const text = await response.text().catch(() => "");
  return new NextResponse(text || null, {status: response.status});
});
