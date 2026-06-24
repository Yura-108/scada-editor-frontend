import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const {id} = params;

  const response = await fetch(`${BACKEND_URL}/api/editor/components/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка ${response.status}: ${text}`);
  }

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});

export const DELETE = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const {id} = params;

  const response = await fetch(`${BACKEND_URL}/api/editor/components/scene/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка ${response.status}: ${text}`);
  }

  return NextResponse.json({success: true});
});