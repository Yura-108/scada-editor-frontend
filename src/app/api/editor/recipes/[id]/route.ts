import {protectedRoute} from "@/lib/protected";
import {NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const GET = protectedRoute(async (_request, {token, params}) => {
  const {id} = params;

  const response = await fetch(`${BACKEND_URL}/api/editor/recipes/${id}`, {
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

export const PUT = protectedRoute(async (req, {token, params}) => {
  const {id} = params;

  const updatedRecipe = await req.json().catch(() => null);

  if (!updatedRecipe) {
    return NextResponse.json(
      {error: "Рецепт пуст!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/recipes/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedRecipe),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(
      {error: err?.message || "Ошибка редактирования"},
      {status: response.status}
    );
  }

  const recipe = await response.json().catch(() => null);

  return NextResponse.json(recipe);
});

export const DELETE = protectedRoute(async (_request, {token, params}) => {
  const {id} = params;

  const response = await fetch(`${BACKEND_URL}/api/editor/recipes/${id}`, {
    method: "DELETE",
    headers: {Authorization: `Bearer ${token}`},
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(
      {error: err?.message || "Ошибка удаления"},
      {status: response.status}
    );
  }

  return new NextResponse(null, {status: 204});
});
