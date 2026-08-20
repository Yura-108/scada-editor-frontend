import { NextRequest, NextResponse } from 'next/server';
import {protectedRoute} from "@/lib/protected";
import {backendErrorResponse} from "@/lib/backendProxy";

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
    const backendResponse = await fetch(`${BACKEND_URL}/api/channel/param/update`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(changes),
    });

    // `.json().catch(() => ({}))` съедал непарсируемое тело: клиент получал `{}`
    // и показывал «Ошибка бэкенда» вместо реального сообщения.
    if (!backendResponse.ok) return backendErrorResponse(backendResponse);

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

  const response = await fetch(`${BACKEND_URL}/api/channel/param`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(param),
  });

  // Ответ не проверялся вовсе: отказ бэкенда возвращался клиенту как 201 с телом
  // ошибки, и параметр «добавлялся» только в интерфейсе.
  if (!response.ok) return backendErrorResponse(response);

  const newParam = await response.json().catch(() => null);

  return NextResponse.json(newParam, {status: 201});
})
