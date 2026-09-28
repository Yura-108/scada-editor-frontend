import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {proxyProcedure} from "@/lib/procedureProxy";

/** `runtime.archive.max-tags-per-request` — больше бэкенд отвергнет 400. */
const MAX_TAGS = 20;
const MAX_POINTS = 5000;

const badRequest = (message: string) => NextResponse.json({message}, {status: 400});

/**
 * История тегов для трендов (контракт 2026-09-28-tag-archive-contract.md, раздел 3).
 *
 * Прокси через gateway, как остальные ручки рантайма. Статус бэкенда пробрасываем как
 * есть: его 400 (период старше 30 дней, `from >= to`) — текст для оператора, а не сбой.
 * Проверки здесь — только то, что иначе ушло бы на бэкенд заведомо битым.
 */
export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const sp = req.nextUrl.searchParams;
  const tags = sp.getAll("tag").map(t => t.trim()).filter(Boolean);
  if (!tags.length) return badRequest("Нужен хотя бы один параметр tag");
  if (tags.length > MAX_TAGS) return badRequest(`Не больше ${MAX_TAGS} тегов за запрос`);

  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return badRequest("Параметры from и to обязательны и должны быть датами ISO-8601");
  }

  const query = new URLSearchParams();
  for (const tag of tags) query.append("tag", tag);
  query.set("from", from);
  query.set("to", to);

  const maxPoints = sp.get("maxPoints");
  if (maxPoints !== null) {
    const n = Number(maxPoints);
    if (!Number.isSafeInteger(n) || n < 1) return badRequest("maxPoints должен быть целым положительным числом");
    query.set("maxPoints", String(Math.min(n, MAX_POINTS)));
  }

  return proxyProcedure(`/api/runtime/archive/values?${query}`, token);
});
