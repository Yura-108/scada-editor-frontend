import {NextRequest, NextResponse} from 'next/server';
import {backendErrorResponse} from "@/lib/backendProxy";
import {protectedRoute, decodeJwtUsername} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

/**
 * Правка свойства компонента → `PUT /api/editor/properties/{id}`.
 *
 * Тело пробрасывается как есть, вместе с `based_on_version` (§8 контракта версий).
 * Перенос свойства на другой компонент бэкенд больше не выполняет: `component_id`
 * обязан совпадать с нынешним владельцем либо отсутствовать, иначе 400.
 */
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

  // X-Username нужен бэкенду, чтобы перенести значения наборов на новое имя при
  // переименовании строки (см. FRONTEND_TABLES_CHANGES.md, п.2) — единственный
  // способ узнать имя пользователя сейчас — декодировать его же JWT.
  const response = await fetch(`${BACKEND_URL}/api/editor/properties/${propertyId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Username': decodeJwtUsername(token),
    },
    body: JSON.stringify(propertyDTO),
  });

  // Насквозь, без обёртки: тем же путём приходит 409 `version_mismatch` (§8), и его
  // тело нужно клиенту целиком — из `current_version` он берёт новую базу.
  if (!response.ok) return backendErrorResponse(response);

  const updatedProperty = await response.json().catch(() => null);

  return NextResponse.json(updatedProperty);
});
