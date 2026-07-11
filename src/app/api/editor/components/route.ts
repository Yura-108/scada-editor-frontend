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

  // Бэкенд мог отклонить сохранение (например, невалидный payload). Раньше прокси
  // ВСЕГДА возвращал 201, поэтому клиент считал сохранение успешным, перезагружал
  // сцену и получал пустой ответ — затирая холст несохранёнными данными.
  // Пробрасываем реальный статус и тело ошибки, чтобы exportScene не перезагружал сцену.
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return new NextResponse(text || JSON.stringify({error: `Ошибка ${response.status}`}), {
      status: response.status,
      headers: {"Content-Type": response.headers.get("content-type") ?? "application/json"},
    });
  }

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

  // Как и в POST: не маскируем ошибку бэкенда статусом 201 — пробрасываем реальный ответ.
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return new NextResponse(text || JSON.stringify({error: `Ошибка ${response.status}`}), {
      status: response.status,
      headers: {"Content-Type": response.headers.get("content-type") ?? "application/json"},
    });
  }

  const editorElements = await response.json().catch(() => null);

  return NextResponse.json(editorElements, {status: 201});
})
