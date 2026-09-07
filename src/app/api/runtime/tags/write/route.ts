import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";

// Как и применение рецепта: REST идёт через gateway, не напрямую на :8085.
const BACKEND_URL = process.env.BACKEND_URL_RUNTIME || process.env.BACKEND_URL || "http://localhost:8080";

/**
 * Запись значения ОДНОГО тега в ПЛК («Опции» компонента в мониторе).
 *
 * До этого точечной записи в проекте не было вовсе: значение уходило в контроллер
 * только целым сохранённым рецептом (`/api/runtime/recipes/apply`) либо изнутри
 * серверного Java-скрипта, где оно зашито в код. Оператору нужно произвольное
 * значение, поэтому запрос отдельный.
 *
 * Адрес тега — ПУТЬ КАНАЛА (`tagId` == `tagName` в команде шлюза). Числовые
 * идентификаторы наружу не публикуются и для записи не годятся —
 * docs/contract/TAG_CONTRACT_CHANGES.md, принцип 1 и A4.
 */
export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null);
  const tagId = typeof body?.tagId === "string" ? body.tagId.trim() : "";

  if (!tagId) {
    return NextResponse.json(
        {error: "Параметр tagId обязателен и должен быть непустой строкой"},
        {status: 400},
    );
  }

  // Пустая строка — допустимое значение (строковый тег), а вот отсутствие поля нет:
  // иначе на контроллер уйдёт запись неизвестно чего.
  if (body?.value === undefined || body?.value === null) {
    return NextResponse.json(
        {error: "Параметр value обязателен"},
        {status: 400},
    );
  }

  // sessionId нужен бэкенду, чтобы отнести команду к сессии оператора (как и в
  // apply рецепта). Таймаут больше клиентского (20с): ответ ждёт подтверждения
  // брокера, и обрывать запрос раньше бэкенда BFF не должен.
  const response = await fetch(`${BACKEND_URL}/api/runtime/tags/write`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tagId,
      value: String(body.value),
      sessionId: body?.sessionId,
      projectId: body?.projectId,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const data = await response.json().catch(() => null);

  // Пробрасываем реальный статус бэкенда: отказ шлюза (REJECTED_*/FAILED_*) фронт
  // показывает оператору дословно, а не как «ошибку сети».
  return NextResponse.json(data, {status: response.status});
});
