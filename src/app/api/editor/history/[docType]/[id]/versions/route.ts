import {NextRequest, NextResponse} from "next/server";
import {backendErrorResponse} from "@/lib/backendProxy";
import {protectedRoute} from "@/lib/protected";
import {
  badPath,
  buildVersionsQuery,
  EDITOR_BACKEND_URL,
  parseDocType,
  parseId,
} from "@/lib/editorHistoryProxy";

/**
 * Список версий документа: `GET /api/editor/{scenes|templates}/{id}/versions`.
 *
 * Свежие первыми. Постраничности через offset нет намеренно: история только
 * дописывается, и «показать ещё» делается повторным запросом с `to = created_at`
 * последней показанной строки — при таком курсоре чужое сохранение во время
 * листания не сдвигает выдачу.
 */
export const GET = protectedRoute(async (req: NextRequest, {token, params}) => {
  const docType = parseDocType(params.docType);
  if (!docType) return badPath("Неизвестный тип документа: ожидается scenes или templates");

  const id = parseId(params.id);
  if (id === null) return badPath("Идентификатор документа должен быть целым числом");

  const query = buildVersionsQuery(req.nextUrl.searchParams);

  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/${docType}/${id}/versions${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(Array.isArray(data) ? data : []);
});
