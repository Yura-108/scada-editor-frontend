import {backendErrorResponse} from "@/lib/backendProxy";
import {protectedRoute} from "@/lib/protected";
import {NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const PUT = protectedRoute(async (req, { token, params }) => {
  const { id } = params;

  const newPaletteItem = await req.json();

  if (!newPaletteItem) {
    return NextResponse.json(
      {message: "Шаблон пуст!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/templates/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // based_on_version / save_kind — полями рядом, без конверта (см. POST палитры).
    body: JSON.stringify(newPaletteItem),
  });

  // Тело ошибки идёт насквозь: 409 несёт base_version/current_version, по которым
  // строится диалог конфликта, а прежняя пересборка в {error} их теряла.
  if (!response.ok) return backendErrorResponse(response);

  const paletteItem = await response.json().catch(() => null);

  return NextResponse.json(paletteItem);
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
