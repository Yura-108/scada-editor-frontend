import {NextRequest, NextResponse} from "next/server";
import {backendErrorResponse} from "@/lib/backendProxy";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseDocType, parseId} from "@/lib/editorHistoryProxy";

/**
 * Состояние документа на момент времени: последняя версия, созданная не позже `time`.
 *
 * Точность — точки сохранения, а не непрерывная запись: правка в 13:58 при ближайшем
 * сохранении в 14:05 даст на запрос «14:00» состояние на 13:50. В интерфейсе большего
 * обещать нельзя.
 */
export const GET = protectedRoute(async (req: NextRequest, {token, params}) => {
  const docType = parseDocType(params.docType);
  if (!docType) return badPath("Неизвестный тип документа: ожидается scenes или templates");

  const id = parseId(params.id);
  if (id === null) return badPath("Идентификатор документа должен быть целым числом");

  const time = req.nextUrl.searchParams.get("time");
  if (!time) return badPath("Параметр time обязателен (ISO date-time)");

  const response = await fetch(
    `${EDITOR_BACKEND_URL}/api/editor/${docType}/${id}/at?time=${encodeURIComponent(time)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});
