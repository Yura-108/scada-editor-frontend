import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";

// И REST, и WebSocket монитора идут через gateway (Bearer обязателен). Сам сокет
// браузер открывает по `wsPath` из ответа — `/ws/runtime/<instanceId>/<sessionId>`:
// экземпляров runtime несколько, и нужный gateway выбирает по имени в пути.
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
  if (!response.ok || !data) {
    return NextResponse.json(data, {status: response.status});
  }

  // Сокет браузер открывает сам (через gateway, по wsPath из этого ответа): httpOnly-cookie
  // ему не видна, а заголовок Authorization браузерный WebSocket слать не умеет — поэтому
  // отдаём тот же JWT в теле ответа, фронт добавит его как ?token= к wsPath.
  return NextResponse.json({...data, token}, {status: response.status});
});
