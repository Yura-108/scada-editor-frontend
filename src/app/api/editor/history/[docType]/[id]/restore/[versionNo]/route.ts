import {NextRequest, NextResponse} from "next/server";
import {backendErrorResponse} from "@/lib/backendProxy";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseDocType, parseId} from "@/lib/editorHistoryProxy";

/**
 * Восстановление версии.
 *
 * Восстановление не отматывает историю, а дописывает её: создаётся новая версия с
 * `kind: "RESTORE"` и ссылкой `restored_from`. Отсюда «отменить отмену» работает само
 * собой (это восстановление предыдущей версии), а номера версий никогда не убывают.
 *
 * Содержимое приходит прямо в ответе — вторым запросом за ним ходить не нужно.
 */
export const POST = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const docType = parseDocType(params.docType);
  if (!docType) return badPath("Неизвестный тип документа: ожидается scenes или templates");

  const id = parseId(params.id);
  if (id === null) return badPath("Идентификатор документа должен быть целым числом");

  const versionNo = parseId(params.versionNo);
  if (versionNo === null) return badPath("Номер версии должен быть целым числом");

  const response = await fetch(
    `${EDITOR_BACKEND_URL}/api/editor/${docType}/${id}/restore/${versionNo}`,
    {
      method: "POST",
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
