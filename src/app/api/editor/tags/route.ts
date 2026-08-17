import {NextRequest, NextResponse} from 'next/server';
import {backendErrorResponse} from "@/lib/backendProxy";
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

/**
 * Создание свойства компонента → `POST /api/editor/properties`.
 *
 * Тело пробрасывается как есть, вместе с `based_on_version` (§8 контракта версий):
 * точечная правка свойства меняет сцену так же, как сохранение компонентов, и с
 * 17.08.2026 проверяется тем же гардом версии. Номер кладёт клиент — только он знает,
 * какую версию сцены человек открыл и правил.
 */
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

  // Тело ошибки идёт насквозь, а не заворачивается в свой `{error}`: по контракту
  // сюда приходит 409 с телом `version_mismatch` (`base_version`/`current_version`),
  // и клиент разбирает его тем же обработчиком, что и конфликт сохранения сцены.
  // Склейка в строку `Ошибка 409: …` эту структуру уничтожала.
  if (!response.ok) return backendErrorResponse(response);

  const newProperty = await response.json().catch(() => null);

  return NextResponse.json(newProperty, {status: 201});
})


