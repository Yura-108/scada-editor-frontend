import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId, passThrough} from "@/lib/editorHistoryProxy";
import {RUNTIME_BACKEND_URL} from "@/lib/procedureProxy";
import type {PropertyWriteItemDto} from "@/types/runtimeWrite.types";

const badRequest = (message: string) => NextResponse.json({message}, {status: 400});

/**
 * Запись значений ЛОКАЛЬНЫХ свойств (без тега) из инспектора объектов
 * (docs/contract/2026-10-01-object-inspector-contract.md). Теговые свойства пишутся через
 * `/api/runtime/tags/write` — бэк вернёт на них `TAG_PROPERTY`.
 *
 * Тело — всегда массив `writes`; ответ — массив того же размера и порядка. `value` — строка, тип
 * приводит бэк по `value_type` из выпуска. Статус — как есть: 409 — проект не в эксплуатации.
 * Запись попадает в журнал действий (`PROPERTY_WRITE`), пользователь — из токена.
 */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");

  const body = await req.json().catch(() => null) as {writes?: unknown} | null;
  if (!Array.isArray(body?.writes) || !body.writes.length) {
    return badRequest("Параметр writes обязателен и должен быть непустым массивом записей");
  }
  const writes: PropertyWriteItemDto[] = [];
  for (const [i, raw] of body.writes.entries()) {
    const item = raw as {propertyId?: unknown; value?: unknown} | null;
    if (typeof item?.propertyId !== "number" || !Number.isSafeInteger(item.propertyId)) {
      return badRequest(`writes[${i}]: propertyId обязателен и должен быть целым числом`);
    }
    if (item.value === undefined || item.value === null) {
      return badRequest(`writes[${i}]: параметр value обязателен`);
    }
    writes.push({propertyId: item.propertyId, value: String(item.value)});
  }

  const response = await fetch(`${RUNTIME_BACKEND_URL}/api/runtime/projects/${projectId}/properties/write`, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({writes}),
    signal: AbortSignal.timeout(25_000),
  });
  return passThrough(response);
});
