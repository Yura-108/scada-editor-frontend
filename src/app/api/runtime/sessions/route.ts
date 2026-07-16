import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";

// REST рантайма идёт через gateway (Bearer обязателен); сам WebSocket фронт
// открывает НАПРЯМУЮ на рантайм-сервис :8085 (NEXT_PUBLIC_RUNTIME_WS_URL) —
// gateway не проксирует WS-upgrade.
const BACKEND_URL = process.env.BACKEND_URL_RUNTIME || process.env.BACKEND_URL || "http://localhost:8080";

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null);
  const projectId = Number(body?.projectId);

  if (!Number.isSafeInteger(projectId)) {
    return NextResponse.json(
      {error: "Параметр projectId обязателен и должен быть целым числом (int64)"},
      {status: 400},
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/runtime/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({projectId}),
  });

  const data = await response.json().catch(() => null);

  // Пробрасываем реальный статус бэкенда (400 = проект не найден и т.п.).
  return NextResponse.json(data, {status: response.status});
});
