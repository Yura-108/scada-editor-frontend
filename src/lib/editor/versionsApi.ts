import type {
  RawRestoreResponse,
  RestoreSceneResponse,
  VersionDocType,
  VersionListQuery,
  VersionSummary,
} from "@/types/editorVersion.types";
import {rootComponentsOf} from "@/lib/editor/documentComponents";

/**
 * Клиент истории версий документа (сцены и шаблоны) — тонкая обёртка над нашими
 * BFF-роутами `/api/editor/history/{docType}/{id}/…`.
 *
 * Живёт отдельно от стора, потому что этими же вызовами пользуется панель истории,
 * а тащить её через стор ради одного GET не за чем.
 */

const base = (docType: VersionDocType, id: number) => `/api/editor/history/${docType}/${id}`;

/** Достаёт человекочитаемое сообщение из тела ошибки; форма `{message}` — общая для прокси. */
const failure = async (res: Response, fallback: string): Promise<Error> => {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === "string" && parsed.message) return new Error(parsed.message);
  } catch {
    // не JSON — покажем как есть
  }
  return new Error(`${fallback} (${res.status})`);
};

/**
 * Список версий, свежие первыми.
 *
 * `kinds` уходит несколькими параметрами `kind` — так задан контракт. «Показать ещё»
 * делается повторным вызовом с `to = created_at` последней показанной строки:
 * offset'а нет намеренно, история только дописывается, и курсор по времени не съезжает,
 * если во время листания кто-то сохранил документ.
 */
export const fetchVersions = async (
  docType: VersionDocType,
  id: number,
  {from, to, kinds, limit}: VersionListQuery = {},
): Promise<VersionSummary[]> => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (limit != null) params.set("limit", String(limit));
  (kinds ?? []).forEach(kind => params.append("kind", kind));

  const query = params.toString();
  const res = await fetch(`${base(docType, id)}/versions${query ? `?${query}` : ""}`);

  if (!res.ok) throw await failure(res, "Не удалось загрузить историю версий");

  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data : [];
};

/** Содержимое версии — та же структура, что у обычного GET документа. */
export const fetchVersionContent = async (
  docType: VersionDocType,
  id: number,
  versionNo: number,
): Promise<Record<string, unknown> | null> => {
  const res = await fetch(`${base(docType, id)}/versions/${versionNo}`);

  if (!res.ok) throw await failure(res, "Не удалось загрузить версию");

  return res.json().catch(() => null);
};

/** Состояние на момент времени (ближайшая версия не позже `time`, ISO date-time). */
export const fetchVersionAt = async (
  docType: VersionDocType,
  id: number,
  time: string,
): Promise<Record<string, unknown> | null> => {
  const res = await fetch(`${base(docType, id)}/at?time=${encodeURIComponent(time)}`);

  if (!res.ok) throw await failure(res, "Не удалось загрузить состояние на момент времени");

  return res.json().catch(() => null);
};

/** Восстановление версии: дописывает историю новой версией kind=RESTORE и сразу отдаёт содержимое. */
export const restoreVersionRequest = async (
  docType: VersionDocType,
  id: number,
  versionNo: number,
): Promise<RestoreSceneResponse> => {
  const res = await fetch(`${base(docType, id)}/restore/${versionNo}`, {method: "POST"});

  if (!res.ok) throw await failure(res, "Не удалось восстановить версию");

  const data: RawRestoreResponse | null = await res.json().catch(() => null);

  return {
    // В `components` ответа восстановления лежит ДОКУМЕНТ целиком, а не массив
    // (§5 контракта). Проверка `Array.isArray` здесь давала бы пустой массив, то есть
    // восстановление молча стирало бы сцену.
    components: rootComponentsOf(data?.components) as Record<string, unknown>[],
    version_no: typeof data?.version_no === "number" ? data.version_no : null,
    ...(typeof data?.restored_from === "number" ? {restored_from: data.restored_from} : {}),
  };
};

/**
 * Текущий номер версии документа = version_no самой свежей записи истории.
 *
 * Отдельный запрос нужен потому, что обычный GET сцены поле `version_no` сегодня не
 * возвращает (вопрос бэкенду открыт). Как только оно там появится, этот вызов станет
 * не нужен — но история уже работает, и завязываться на неё безопаснее.
 * `null` — версий ещё нет, значит это первое сохранение и based_on_version не шлём.
 */
export const fetchCurrentVersion = async (
  docType: VersionDocType,
  id: number,
): Promise<number | null> => {
  const list = await fetchVersions(docType, id, {limit: 1});
  return list[0]?.version_no ?? null;
};
