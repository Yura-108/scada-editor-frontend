import {protectedRoute} from "@/lib/protected";
import {NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const PUT = protectedRoute(async (req, { token, params }) => {
  const { id } = params;

  const newPaletteItem = await req.json();

  if (!newPaletteItem) {
    return NextResponse.json(
      {error: "Шаблон пуст!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/templates/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",  // ← добавить это
    },
    body: JSON.stringify(newPaletteItem),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => {});
    return NextResponse.json(
      { error: err?.message || "Ошибка редактирования" },
      { status: response.status }
    );
  }

  const paletteItem = await response.json().catch(() => null);

  return NextResponse.json(paletteItem, {status: 201});
});

export const DELETE = protectedRoute(async (_request, { token, params }) => {
  const { id } = params;

  const response = await fetch(`${BACKEND_URL}/api/editor/templates/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => {});
    return NextResponse.json(
      { error: err?.message || "Ошибка удаления" },
      { status: response.status }
    );
  }

  return new NextResponse(null, { status: 204 });
});
