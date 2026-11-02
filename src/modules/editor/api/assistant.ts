import {useMutation} from "@tanstack/react-query";
import {describeDenial, isAccessDenial} from "@/core/access";
import type {
  ScenePlanRequest, ScenePlanResponse, ScriptEditRequest, ScriptEditResponse,
  ScriptGenerateRequest, ScriptGenerateResponse, TagResolveRequest, TagResolveResponse,
} from "../types/assistant.types";

/**
 * Запросы помощника (docs/contract/2026-11-02-assistant-frontend-contract.md).
 *
 * Отвечает помощник долго: обычно 0,5–4 с, первый запрос после простоя 10–15 с, `scripts/edit` —
 * по скрипту за вызовом модели. Отмены на сервере нет, поэтому и здесь её нет: кнопку на время
 * запроса блокирует вызывающий (`isPending`).
 */

/** Ошибка помощника с текстом для пользователя. */
export class AssistantError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AssistantError";
  }
}

/**
 * Текст ошибки по коду. `503` — обычная ситуация: функция тестовая, модель может быть не
 * запущена, и редактор при этом работает как обычно.
 */
export function assistantErrorText(status: number, body: unknown): string {
  if (isAccessDenial(body)) return describeDenial(body);
  const raw = (body as {error?: unknown; message?: unknown} | null);
  const reason = typeof raw?.error === "string" && raw.error ? raw.error
    : typeof raw?.message === "string" && raw.message ? raw.message : "";
  if (status === 503) return "Помощник сейчас недоступен";
  if (status === 502) return "Модель вернула неполный ответ — упростите задание или повторите";
  if (status === 401) return "Сессия истекла — войдите заново";
  if (status === 403) return reason || "Нет права правки в проекте";
  if (status === 400) return reason ? `Запрос не принят: ${reason}` : "Запрос не принят — проверьте задание";
  return reason || `Ошибка помощника (${status})`;
}

async function post<T>(projectId: number, path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/assistant/projects/${projectId}/${path}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
    });
  } catch {
    throw new AssistantError("Помощник сейчас недоступен", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new AssistantError(assistantErrorText(res.status, data), res.status);
  if (data == null) throw new AssistantError("Помощник вернул пустой ответ", res.status);
  return data as T;
}

/** Черновик скрипта по описанию задачи. */
export const useScriptGenerate = (projectId: number | null) => useMutation({
  mutationFn: (req: ScriptGenerateRequest) =>
    post<ScriptGenerateResponse>(requireProject(projectId), "scripts/generate", req),
});

/** Предложения правки по набору скриптов. */
export const useScriptEdit = (projectId: number | null) => useMutation({
  mutationFn: (req: ScriptEditRequest) =>
    post<ScriptEditResponse>(requireProject(projectId), "scripts/edit", req),
});

/** Кандидаты тега по описанию. */
export const useTagResolve = (projectId: number | null) => useMutation({
  mutationFn: (req: TagResolveRequest) =>
    post<TagResolveResponse>(requireProject(projectId), "tags/resolve", req),
});

/** План сцены (только просмотр). */
export const useScenePlan = (projectId: number | null) => useMutation({
  mutationFn: (req: ScenePlanRequest) =>
    post<ScenePlanResponse>(requireProject(projectId), "scenes/plan", req),
});

function requireProject(projectId: number | null): number {
  if (projectId == null) throw new AssistantError("Проект не выбран", 0);
  return projectId;
}
