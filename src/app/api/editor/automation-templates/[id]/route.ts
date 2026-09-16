import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Один шаблон задачи: `PUT/DELETE /api/editor/automation-templates/{id}`.
 *
 * `GET /{id}` на бэкенде есть, но фронту не нужен: список приходит целиком.
 * Сохранение перезаписывает шаблон — `based_on_version` у шаблонов нет, при
 * одновременной правке двумя людьми выигрывает последняя запись.
 */
const templateUrl = (id: number) => `${EDITOR_BACKEND_URL}/api/editor/automation-templates/${id}`;

export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const id = parseId(params.id);
  if (id === null) return badPath("Идентификатор шаблона должен быть целым числом");
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({message: "Пустое тело запроса"}, {status: 400});
  const response = await fetch(templateUrl(id), {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  return passThrough(response);
});

export const DELETE = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const id = parseId(params.id);
  if (id === null) return badPath("Идентификатор шаблона должен быть целым числом");
  const response = await fetch(templateUrl(id), {
    method: "DELETE",
    headers: {Authorization: `Bearer ${token}`},
  });
  return passThrough(response);
});
