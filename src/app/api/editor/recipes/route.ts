import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

/**
 * Процедурные рецепты. Список ПЛОСКИЙ: у рецепта больше нет `component_id`, и фильтра
 * `?componentId=` на бэкенде тоже не осталось (`RecipeController.list()`).
 */
export const GET = protectedRoute(async (_req: NextRequest, {token}) => {
  const response = await fetch(`${BACKEND_URL}/api/editor/recipes`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const newRecipe = await req.json().catch(() => null);

  if (!newRecipe) {
    return NextResponse.json({error: "Рецепт пуст!"}, {status: 400});
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/recipes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newRecipe),
  });

  // Тело ошибки бэкенда отдаём как есть: у 400-х здесь осмысленный `message`
  // («action references tag(s) not declared in manifest 'tags': [FOO]»), и он точнее,
  // чем любая наша формулировка.
  if (!response.ok) return backendErrorResponse(response);

  const recipe = await response.json().catch(() => null);

  return NextResponse.json(recipe, {status: 201});
});
