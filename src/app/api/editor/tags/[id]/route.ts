import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const propertyId = Number(params?.id);

  if (!Number.isSafeInteger(propertyId)) {
    return NextResponse.json(
      {error: "Некорректный id свойства"},
      {status: 400}
    );
  }

  const propertyDTO = await req.json().catch(() => null);

  if (!propertyDTO) {
    return NextResponse.json(
      {error: "Тело запроса пустое!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/properties/${propertyId}`, {
    method: 'PUT',
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

  const updatedProperty = await response.json().catch(() => null);

  return NextResponse.json(updatedProperty);
});
