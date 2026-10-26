import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId, passThrough} from "@/lib/editorHistoryProxy";
import {RUNTIME_BACKEND_URL} from "@/lib/procedureProxy";

const badRequest = (message: string) => NextResponse.json({message}, {status: 400});

/** Предел бэкенда: больше — 400. */
const MAX_ALARMS = 100;

/**
 * Квитирование аварий ПЛК (docs/contract/2026-10-26-pac-alarms-frontend-contract.md, §3.3).
 *
 * Тело — `{alarms: [{controllerId, key}], sessionId?}`; ответ — исход по каждой аварии. Статус —
 * как есть: 403 — нет права `operate`, 409 — проект не в эксплуатации. Квитирование попадает в
 * журнал действий (`ALARM_ACK`), пользователь — из токена.
 */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");

  const body = await req.json().catch(() => null) as {alarms?: unknown; sessionId?: unknown} | null;
  if (!Array.isArray(body?.alarms) || !body.alarms.length) {
    return badRequest("Параметр alarms обязателен и должен быть непустым массивом аварий");
  }
  if (body.alarms.length > MAX_ALARMS) {
    return badRequest(`Не больше ${MAX_ALARMS} аварий за запрос`);
  }
  const alarms: {controllerId: string; key: string}[] = [];
  for (const [i, raw] of body.alarms.entries()) {
    const item = raw as {controllerId?: unknown; key?: unknown} | null;
    if (typeof item?.controllerId !== "string" || !item.controllerId) {
      return badRequest(`alarms[${i}]: controllerId обязателен`);
    }
    if (typeof item.key !== "string" || !item.key) {
      return badRequest(`alarms[${i}]: key обязателен`);
    }
    alarms.push({controllerId: item.controllerId, key: item.key});
  }
  const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : undefined;

  const response = await fetch(`${RUNTIME_BACKEND_URL}/api/runtime/projects/${projectId}/alarms/ack`, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify(sessionId ? {alarms, sessionId} : {alarms}),
    signal: AbortSignal.timeout(25_000),
  });
  return passThrough(response);
});
