import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const propertyDTO = await req.json();

  if (!propertyDTO) {
    return NextResponse.json(
      {error: "Шаблон пуст!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/properties`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(propertyDTO),
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

  const newProperty = await response.json().catch(() => null);

  return NextResponse.json(newProperty, {status: 201});
})


