import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

function parseComponentId(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get('componentId');
  if (raw === null || raw === '') return null;

  const componentId = Number(raw);
  if (!Number.isSafeInteger(componentId)) return null;

  return componentId;
}

export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const componentId = parseComponentId(req.nextUrl.searchParams);
  if (componentId === null) {
    return NextResponse.json(
      {error: "Параметр componentId обязателен и должен быть целым числом"},
      {status: 400}
    );
  }

  const response = await fetch(
    `${BACKEND_URL}/api/editor/recipes?componentId=${componentId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const newRecipe = await req.json().catch(() => null);

  if (!newRecipe) {
    return NextResponse.json(
      {error: "Рецепт пуст!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/recipes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newRecipe),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Неизвестная ошибка");

    return NextResponse.json(
      {error: `Ошибка ${response.status}: ${errorText}`},
      {status: response.status}
    );
  }

  const recipe = await response.json().catch(() => null);

  return NextResponse.json(recipe, {status: 201});
});
