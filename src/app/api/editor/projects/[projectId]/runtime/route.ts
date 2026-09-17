import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Ввод проекта в эксплуатацию: `GET|PUT /api/editor/projects/{projectId}/runtime`
 * ⇄ `{projectId, inOperation}`.
 *
 * Пока флаг не выставлен, рантайм проект не поднимает вовсе: ни телеметрии, ни onChange,
 * ни процедур, — и монитор такого проекта получает 409 на создание сессии. Снятие флага,
 * наоборот, гасит проект и останавливает идущие процедуры, поэтому выключение в интерфейсе
 * подтверждается.
 *
 * `X-Username` не передаём — его проставляет gateway.
 */
const flagUrl = (projectId: number) =>
  `${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/runtime`;

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(flagUrl(projectId), {
    method: "GET",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
  });
  return passThrough(response);
});

export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");

  const body = await req.json().catch(() => null);
  const inOperation = (body as {inOperation?: unknown} | null)?.inOperation;
  if (typeof inOperation !== "boolean") {
    return NextResponse.json(
      {message: "Параметр inOperation обязателен и должен быть true или false"},
      {status: 400},
    );
  }

  const response = await fetch(flagUrl(projectId), {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({inOperation}),
  });
  return passThrough(response);
});
