import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId, passThrough} from "@/lib/editorHistoryProxy";

/**
 * Автопривязка проекта к базе каналов: `POST /api/editor/projects/{projectId}/autobind`
 * с телом `{channel_root}`.
 *
 * Бэкенд находит компоненту объект по её имени, а теговому свойству — поле по имени свойства,
 * и перезаписывает `tag_id` у совпавших. Каждая изменённая сцена получает версию `MANUAL`,
 * поэтому отменяется это восстановлением предыдущей версии, а не повторным запросом.
 *
 * Связь «проект редактора ↔ база каналов» нигде не хранится — корень приходит в каждом запросе.
 *
 * `X-Username` не передаём — его проставляет gateway.
 */
const autobindUrl = (projectId: number) =>
  `${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/autobind`;

export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");

  const body = await req.json().catch(() => null);
  const channelRoot = (body as {channel_root?: unknown} | null)?.channel_root;
  if (typeof channelRoot !== "string" || !channelRoot.trim()) {
    return NextResponse.json({message: "Выберите базу каналов"}, {status: 400});
  }

  const response = await fetch(autobindUrl(projectId), {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({channel_root: channelRoot.trim()}),
  });
  return passThrough(response);
});
