import {NextRequest, NextResponse} from "next/server";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "./editorHistoryProxy";

/**
 * Общая часть прокси помощника: `POST /api/assistant/projects/{projectId}/<путь>`
 * (docs/contract/2026-11-02-assistant-frontend-contract.md).
 *
 * Путь — из белого списка, а не «как пришло»: иначе сегмент из адресной строки уезжал бы
 * в запрос к бэкенду. Тело уходит как есть: его проверяет сервис помощника (400 с причиной).
 *
 * Таймаута нет намеренно: сервер ждёт модель до 120 с на один вызов, а `scripts/edit` идёт
 * по скрипту за вызовом. Короткий таймаут здесь обрывал бы ответы, которые ещё придут.
 * `X-Username` не передаём — его проставляет gateway.
 */
export type AssistantPath = "scripts/generate" | "scripts/edit" | "tags/resolve" | "scenes/plan";

export async function proxyAssistant(req: NextRequest, token: string, rawProjectId: unknown, path: AssistantPath) {
  const projectId = parseId(rawProjectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");

  const body = await req.text().catch(() => "");
  try {
    const response = await fetch(`${EDITOR_BACKEND_URL}/api/assistant/projects/${projectId}/${path}`, {
      method: "POST",
      headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
      body,
    });
    return passThrough(response);
  } catch (err) {
    // Сервис помощника не поднят вовсе — для пользователя это то же, что 503 от него самого.
    console.error("Помощник недоступен:", err);
    return NextResponse.json({error: "Сервис помощника недоступен"}, {status: 503});
  }
}
