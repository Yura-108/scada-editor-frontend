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

/**
 * Удаление свойства компонента → `DELETE /api/editor/properties/{id}`.
 *
 * `based_on_version` здесь — **query-параметр**, а не поле тела (§8 контракта версий:
 * у POST/PUT он в теле, у DELETE в строке запроса). Клиент кладёт его сам — только он
 * знает, какую версию сцены человек открыл и правил. Нет версий у сцены — параметра
 * нет вовсе: присланный номер при отсутствующей истории бэкенд отвергает 400-м.
 */
export const DELETE = protectedRoute(async (req: NextRequest, {token, params}) => {
  const propertyId = Number(params?.id);

  if (!Number.isSafeInteger(propertyId)) {
    return NextResponse.json(
      {error: "Некорректный id свойства"},
      {status: 400}
    );
  }

  // Переклеиваем только известный параметр, а не весь search целиком: query уходит
  // в чужой сервис, и лишнее из адресной строки редактора туда попадать не должно.
  const basedOnVersion = req.nextUrl.searchParams.get("based_on_version");
  const query = basedOnVersion != null ? `?based_on_version=${encodeURIComponent(basedOnVersion)}` : "";

  // X-Username — как у PUT: по нему бэкенд связывает удалённую строку таблицы со
  // значениями наборов (FRONTEND_TABLES_CHANGES.md, п.2).
  const response = await fetch(`${BACKEND_URL}/api/editor/properties/${propertyId}${query}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Username': decodeJwtUsername(token),
    },
  });

  // Насквозь, без обёртки: тем же путём приходит 409 `version_mismatch` (§8), и его
  // тело нужно клиенту целиком — из `current_version` он берёт новую базу.
  if (!response.ok) return backendErrorResponse(response);

  // Тела у успешного DELETE может не быть — `response.json()` на пустом упал бы.
  return new NextResponse(null, {status: 204});
});
