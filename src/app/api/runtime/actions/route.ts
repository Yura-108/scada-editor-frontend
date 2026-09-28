import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {proxyProcedure} from "@/lib/procedureProxy";

const KINDS = new Set(["ACTION", "PROCEDURE", "TAG_WRITE"]);
const MAX_SIZE = 1000;

const badRequest = (message: string) => NextResponse.json({message}, {status: 400});

/**
 * Журнал действий оператора (контракт 2026-09-28-tag-archive-contract.md, раздел 5).
 *
 * `from`/`to` обязательны, остальное — фильтры. Ответ — массив, новые сверху; общего числа
 * строк бэкенд не отдаёт, поэтому «есть ли ещё» клиент понимает по полной странице.
 */
export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return badRequest("Параметры from и to обязательны и должны быть датами ISO-8601");
  }

  const query = new URLSearchParams({from, to});

  const projectId = sp.get("projectId");
  if (projectId) {
    if (!Number.isSafeInteger(Number(projectId))) return badRequest("projectId должен быть целым числом");
    query.set("projectId", projectId);
  }
  const username = sp.get("username")?.trim();
  if (username) query.set("username", username);
  const kind = sp.get("kind");
  if (kind) {
    if (!KINDS.has(kind)) return badRequest("kind: ACTION, PROCEDURE или TAG_WRITE");
    query.set("kind", kind);
  }
  const page = Number(sp.get("page") ?? 0);
  const size = Number(sp.get("size") ?? 100);
  if (!Number.isSafeInteger(page) || page < 0) return badRequest("page должен быть целым неотрицательным числом");
  if (!Number.isSafeInteger(size) || size < 1) return badRequest("size должен быть целым положительным числом");
  query.set("page", String(page));
  query.set("size", String(Math.min(size, MAX_SIZE)));

  return proxyProcedure(`/api/runtime/actions?${query}`, token);
});
