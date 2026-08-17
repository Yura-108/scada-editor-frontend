import {NextResponse} from "next/server";

/**
 * Общая часть прокси-роутов истории версий (`/api/editor/history/{docType}/{id}/…`).
 *
 * Путь на бэкенде — `/api/editor/{scenes|templates}/{id}/…`, то есть вид документа
 * подставляется В URL. Поэтому `docType` проверяется белым списком, а не «как пришло»:
 * иначе любой сегмент из адресной строки уезжал бы в путь запроса к бэкенду.
 */

export const EDITOR_BACKEND_URL = process.env.BACKEND_URL_EDITOR || "http://localhost:8080";

const DOC_TYPES = ["scenes", "templates"] as const;
export type VersionDocType = (typeof DOC_TYPES)[number];

export const parseDocType = (raw: unknown): VersionDocType | null =>
  typeof raw === "string" && (DOC_TYPES as readonly string[]).includes(raw)
    ? (raw as VersionDocType)
    : null;

/** id/version_no — только целые: та же проверка, что у scene/[id]/route.ts. */
export const parseId = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

/** Ответ на кривые сегменты пути — 400 в том же формате `{message}`, что и остальные ошибки. */
export const badPath = (message: string) => NextResponse.json({message}, {status: 400});

/**
 * Собирает query для списка версий.
 *
 * `kind` контракт разрешает передавать НЕСКОЛЬКО раз (MANUAL + RESTORE и т.п.),
 * поэтому здесь `getAll`, а не `get` — иначе фильтр молча схлопывался бы до одного вида.
 */
export const buildVersionsQuery = (searchParams: URLSearchParams): string => {
  const out = new URLSearchParams();

  for (const name of ["from", "to", "limit"]) {
    const value = searchParams.get(name);
    if (value) out.set(name, value);
  }

  for (const kind of searchParams.getAll("kind")) {
    if (kind) out.append("kind", kind);
  }

  const query = out.toString();
  return query ? `?${query}` : "";
};
