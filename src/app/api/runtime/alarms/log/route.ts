import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {proxyProcedure} from "@/lib/procedureProxy";

const GROUPS = new Set(["тревога", "сообщение", "ответ"]);
const EVENTS = new Set(["RAISED", "ACCEPTED", "RETURNED", "CLEARED", "SUPPRESSED", "UNSUPPRESSED"]);
const MAX_SIZE = 1000;

const badRequest = (message: string) => NextResponse.json({message}, {status: 400});

/**
 * Журнал аварий ПЛК (контракт 2026-10-26-pac-alarms-frontend-contract.md, §4). Параметры — как
 * у журнала действий: `from`/`to` обязательны, без `projectId` — по всем проектам, только
 * администратору (иначе 403). Ответ — массив, новые сверху.
 */
export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return badRequest("Параметры from и to обязательны и должны быть датами ISO-8601");
  }
  if (Date.parse(from) >= Date.parse(to)) return badRequest("from должен быть раньше to");

  const query = new URLSearchParams({from, to});

  const projectId = sp.get("projectId");
  if (projectId) {
    if (!Number.isSafeInteger(Number(projectId))) return badRequest("projectId должен быть целым числом");
    query.set("projectId", projectId);
  }
  const group = sp.get("group");
  if (group) {
    if (!GROUPS.has(group)) return badRequest("group: тревога, сообщение или ответ");
    query.set("group", group);
  }
  const event = sp.get("event");
  if (event) {
    if (!EVENTS.has(event)) return badRequest(`event: ${[...EVENTS].join(", ")}`);
    query.set("event", event);
  }
  const page = Number(sp.get("page") ?? 0);
  const size = Number(sp.get("size") ?? 100);
  if (!Number.isSafeInteger(page) || page < 0) return badRequest("page должен быть целым неотрицательным числом");
  if (!Number.isSafeInteger(size) || size < 1) return badRequest("size должен быть целым положительным числом");
  query.set("page", String(page));
  query.set("size", String(Math.min(size, MAX_SIZE)));

  return proxyProcedure(`/api/runtime/alarms/log?${query}`, token);
});
