import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
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
    body.value.some((item: any) => typeof item.key !== 'string' || item.value === undefined)
  ) {
    return NextResponse.json(
      { message: 'Ожидается { value: [{ key: string, value: string }] }' },
      { status: 400 },
    );
  }

  const changes = body.value as { key: string; value: string }[];

  const backendUrl = `${process.env.BACKEND_URL}/api/param/update`;

  try {
    const backendResponse = await fetch(backendUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
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
}
