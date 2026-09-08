import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import type {TagWriteItemDto} from "@/types/runtimeWrite.types";

// Как и применение рецепта: REST идёт через gateway, не напрямую на :8085.
const BACKEND_URL = process.env.BACKEND_URL_RUNTIME || process.env.BACKEND_URL || "http://localhost:8080";

/**
 * Запись значений тегов в ПЛК («Опции» компонента в мониторе).
 *
 * До этого точечной записи в проекте не было вовсе: значение уходило в контроллер
 * только целым сохранённым рецептом (`/api/runtime/recipes/apply`) либо изнутри
 * серверного Java-скрипта, где оно зашито в код. Оператору нужно произвольное
 * значение, поэтому запрос отдельный.
 *
 * Тело — ВСЕГДА массив записей `writes`, даже когда пишут один тег (тогда в нём один
 * элемент): «Применить для всех» и кнопка у отдельной строки ходят одним путём, и частичного
 * результата от оборванной середины цикла не возникает.
 *
 * Адрес тега — ПУТЬ КАНАЛА (`tagId` == `tagName` в команде шлюза). Числовые
 * идентификаторы наружу не публикуются и для записи не годятся —
 * docs/contract/TAG_CONTRACT_CHANGES.md, принцип 1 и A4.
 */
export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null);
  const rawWrites = (body as {writes?: unknown} | null)?.writes;

  if (!Array.isArray(rawWrites) || !rawWrites.length) {
    return NextResponse.json(
        {error: "Параметр writes обязателен и должен быть непустым массивом записей"},
        {status: 400},
    );
  }

  const writes: TagWriteItemDto[] = [];
  for (const [i, raw] of rawWrites.entries()) {
    const item = raw as {tagId?: unknown; value?: unknown; valueType?: unknown} | null;
    const tagId = typeof item?.tagId === "string" ? item.tagId.trim() : "";

    if (!tagId) {
      return NextResponse.json(
          {error: `writes[${i}]: параметр tagId обязателен и должен быть непустой строкой`},
          {status: 400},
      );
    }

    // Пустая строка — допустимое значение (строковый тег), а вот отсутствие поля нет:
    // иначе на контроллер уйдёт запись неизвестно чего.
    if (item?.value === undefined || item?.value === null) {
      return NextResponse.json(
          {error: `writes[${i}] («${tagId}»): параметр value обязателен`},
          {status: 400},
      );
    }

    // `valueType` (`value_type` свойства) пробрасываем как есть: по нему бэкенд приводит
    // значение к типу канала. Без него значение уходит строкой, и на булевом теге это
    // уезжает неверной уставкой — см. контракт записи от 08.09.2026.
    const valueType = typeof item?.valueType === "string" ? item.valueType : undefined;
    writes.push({tagId, value: String(item.value), ...(valueType ? {valueType} : {})});
  }

  // Повтор одного тега в запросе не отвергаем: контракт это допускает — потому и требует
  // сопоставлять ответ по индексу, а не по `tagId`. Дубли отсеивает само окно «Опций»,
  // где значения ключуются по тегу и второй записи взяться неоткуда.

  // sessionId и projectId нужны бэкенду только для контекста и логов: запись не привязана
  // к состоянию сессии мониторинга. Таймаут больше клиентского (20с) — ответ ждёт
  // подтверждения брокера, и обрывать запрос раньше бэкенда BFF не должен.
  const response = await fetch(`${BACKEND_URL}/api/runtime/tags/write`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: body?.sessionId,
      projectId: body?.projectId,
      writes,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const data = await response.json().catch(() => null);

  // Пробрасываем реальный статус бэкенда: отказ шлюза (REJECTED_*/FAILED_*) фронт
  // показывает оператору дословно, а не как «ошибку сети».
  return NextResponse.json(data, {status: response.status});
});
