import { NextRequest, NextResponse } from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const PATCH = protectedRoute(async (request: NextRequest, {token})=> {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }
  // Валидация: { value: [{ key: string, value: string }] }
  if (
    !body ||
    !Array.isArray(body.value) ||
    body.value.some((item: {key: string; value: string}) => item.value === undefined)
  ) {
    return NextResponse.json(
      { message: 'Ожидается { value: [{ key: string, value: string }] }' },
      { status: 400 },
    );
  }
  const changes = body.value as { key: string; value: string }[];
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/param/update`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(changes),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(errorData || { message: 'Ошибка бэкенда' }, {
        status: backendResponse.status,
      });
    }

    await backendResponse.json();

    return NextResponse.json({ value: changes });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
})

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const param = await req.json();

  if (!param) {
    return NextResponse.json(
      {error: "Неверный тип узла!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/param`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(param),
  });

  const newParam = await response.json().catch(() => null);

  return NextResponse.json(newParam, {status: 201});
})
