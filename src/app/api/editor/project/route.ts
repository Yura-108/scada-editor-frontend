import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json();

  if (!body?.name) {
    return NextResponse.json(
      {error: "Имя проекта не указано"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/components/project`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return backendErrorResponse(response);

  const project = await response.json().catch(() => null);

  return NextResponse.json(project, {status: 201});
});
