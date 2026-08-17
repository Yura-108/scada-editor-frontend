import {NextRequest, NextResponse} from "next/server";
import {backendErrorResponse} from "@/lib/backendProxy";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseDocType, parseId} from "@/lib/editorHistoryProxy";

/**
 * Содержимое конкретной версии.
 *
 * Возвращает ТУ ЖЕ структуру, что и обычный GET документа, — старая версия рисуется
 * тем же кодом, что и текущая, отдельного рендеринга не требуется.
 */
export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const docType = parseDocType(params.docType);
  if (!docType) return badPath("Неизвестный тип документа: ожидается scenes или templates");

  const id = parseId(params.id);
  if (id === null) return badPath("Идентификатор документа должен быть целым числом");

  const versionNo = parseId(params.versionNo);
  if (versionNo === null) return badPath("Номер версии должен быть целым числом");

  const response = await fetch(
    `${EDITOR_BACKEND_URL}/api/editor/${docType}/${id}/versions/${versionNo}`,
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
