import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId} from "@/lib/editorHistoryProxy";

/** automation доступен через gateway (/api/automation/**). */
const AUTOMATION_BACKEND_URL =
  process.env.BACKEND_URL_AUTOMATION || process.env.BACKEND_URL || "http://localhost:8080";

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${AUTOMATION_BACKEND_URL}/api/automation/projects/${projectId}/tasks`, {
    method: "GET",
    headers: {Authorization: `Bearer ${token}`},
  });
  const data = await response.json().catch(() => null);
  return NextResponse.json(Array.isArray(data) ? data : [], {status: response.ok ? 200 : response.status});
});
