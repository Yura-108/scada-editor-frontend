import { protectedRoute } from "@/lib/protected";
import { backendErrorResponse } from "@/lib/backendProxy";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const GET = protectedRoute(async (req: NextRequest, { token }) => {
  try {
    const { searchParams } = new URL(req.url);
    const toDate = searchParams.get('to');
    const fromDate = searchParams.get('from');

    // Проверка на наличие параметров (опционально, но желательно)
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Правильное формирование строки с использованием &
    const targetUrl = `${BACKEND_URL}/api/channel/undo/logs?from=${fromDate}&to=${toDate}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // Рекомендуется добавить cache: 'no-store' для логов, чтобы получать актуальные данные
      cache: 'no-store'
    });

    // Тело бэкенда пробрасываем как есть: обёртка `{error: "Backend error: …"}`
    // прятала `message` из Spring-ответа, и в тосте вместо причины отказа
    // оказывался сырой JSON-блоб.
    if (!response.ok) return backendErrorResponse(response);

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
});

export const POST = protectedRoute(async (req: NextRequest, { token }) => {
  try {
    const id: number = await req.json();

    const response = await fetch(`${BACKEND_URL}/api/channel/undo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([id]),
    });


    if (!response.ok) return backendErrorResponse(response);

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
});
