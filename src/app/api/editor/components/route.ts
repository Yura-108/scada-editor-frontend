import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";
import { log } from 'console';

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const GET = protectedRoute(async (req: NextRequest, {token}) => {

  const response = await fetch(`${BACKEND_URL}/api/editor/components`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`, // ← передаём токен
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

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const canvasScreen = await req.json();

  if (!canvasScreen) {
    return NextResponse.json(
      {error: "Окно редактирования пустое!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/components`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(canvasScreen),
  });

  const editorElements = await response.json().catch(() => null);


  return NextResponse.json(editorElements, {status: 201});
})

export const DELETE = protectedRoute(async (req: NextRequest, {token}) => {
  const ids = await req.json();

  if (!ids) {
    return NextResponse.json(
      {error: "ID не переданы!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/components`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ids),
  });

  const editorElements = await response.json().catch(() => null);

  return NextResponse.json(editorElements, {status: 201});
})
