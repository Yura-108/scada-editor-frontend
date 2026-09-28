import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {proxyProcedure} from "@/lib/procedureProxy";

/** Предел тегов на запрос у бэкенда. */
const MAX_TAGS = 5000;

const badRequest = (message: string) => NextResponse.json({message}, {status: 400});

const isDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/**
 * Воспроизведение сцены по архиву (контракт 2026-09-28-tag-archive-contract.md, раздел 4).
 *
 * Страница: состояние всех тегов на `from` (только в первой) и изменения по возрастанию `ts`;
 * следующая — тем же запросом с `after = next`. Статус бэкенда пробрасываем как есть: его
 * 400 (битый курсор, неверный период) — текст для оператора.
 */
export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null) as
    {tags?: unknown; from?: unknown; to?: unknown; after?: unknown} | null;

  const tags = Array.isArray(body?.tags)
    ? [...new Set(body.tags.filter((t): t is string => typeof t === "string" && t.trim() !== ""))]
    : [];
  if (!tags.length) return badRequest("Нужен непустой список тегов tags");
  if (tags.length > MAX_TAGS) return badRequest(`Не больше ${MAX_TAGS} тегов за запрос`);
  if (!isDate(body?.from) || !isDate(body?.to)) {
    return badRequest("Параметры from и to обязательны и должны быть датами ISO-8601");
  }
  const after = body?.after;
  if (after != null && typeof after !== "string") return badRequest("after должен быть строкой или null");

  return proxyProcedure("/api/runtime/archive/replay", token, {
    method: "POST",
    body: {tags, from: body.from, to: body.to, after: after ?? null},
  });
});
