import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

// Как и создание сессии/снапшот — REST идёт через gateway, не напрямую на :8085.
const BACKEND_URL = process.env.BACKEND_URL_RUNTIME || process.env.BACKEND_URL || "http://localhost:8080";

/**
 * Явное закрытие рантайм-сессии при уходе с экрана монитора — до этого брошенная
 * сессия продолжает получать значения тегов в буфер (подбирает reaper, но не сразу).
 */
export const DELETE = protectedRoute(async (_request: NextRequest, {token, params}) => {
  const {sessionId} = params;

  const response = await fetch(`${BACKEND_URL}/api/runtime/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${token}`},
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    return NextResponse.json({error: `Ошибка ${response.status}: ${text}`}, {status: response.status});
  }

  return new NextResponse(null, {status: 204});
});
