import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";

// Снапшот — REST, идёт через gateway (как создание сессии), а не напрямую на :8085.
const BACKEND_URL = process.env.BACKEND_URL_RUNTIME || process.env.BACKEND_URL || "http://localhost:8080";

function parseComponentId(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get('componentId');
  if (raw === null || raw === '') return null;

  const componentId = Number(raw);
  if (!Number.isSafeInteger(componentId)) return null;

  return componentId;
}

export const GET = protectedRoute(async (req: NextRequest, {token, params}) => {
  const {sessionId} = params;

  const componentId = parseComponentId(req.nextUrl.searchParams);
  if (componentId === null) {
    return NextResponse.json(
      {error: "Параметр componentId обязателен и должен быть целым числом"},
      {status: 400}
    );
  }

  const response = await fetch(
    `${BACKEND_URL}/api/runtime/sessions/${sessionId}/snapshot?componentId=${componentId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});
