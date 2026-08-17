import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";
import { withVersionFields } from '@/lib/saveEnvelope';

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const GET = protectedRoute(async (_req: NextRequest, {token}) => {

  const response = await fetch(`${BACKEND_URL}/api/editor/templates`, {
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
  const newPaletteItem = await req.json();

  if (!newPaletteItem) {
    return NextResponse.json(
      {message: "Шаблон пуст!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    // У шаблона тело и так объект — оборачивать нечего: based_on_version и save_kind
    // едут полями рядом. Пока EDITOR_SAVE_ENVELOPE выключен, они вырезаются.
    body: JSON.stringify(withVersionFields(newPaletteItem)),
  });

  // Раньше здесь тело ошибки пересобиралось в {error: "Ошибка N: …"} — это съедало
  // 409 вместе со списком расхождений, по которому строится диалог конфликта.
  if (!response.ok) return backendErrorResponse(response);

  const paletteItem = await response.json().catch(() => null);

  return NextResponse.json(paletteItem, {status: 201});
})

