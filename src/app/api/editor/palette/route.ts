import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const GET = protectedRoute(async (_req: NextRequest, {token}) => {

  const response = await fetch(`${BACKEND_URL}/api/editor/templates`, {
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

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const newPaletteItem = await req.json();

  if (!newPaletteItem) {
    return NextResponse.json(
      {error: "Шаблон пуст!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newPaletteItem),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Неизвестная ошибка");

    return NextResponse.json(
      {
        error: `Ошибка ${response.status}: ${errorText}`,
      },
      { status: response.status }
    );
  }

  const paletteItem = await response.json().catch(() => null);

  return NextResponse.json(paletteItem, {status: 201});
})

