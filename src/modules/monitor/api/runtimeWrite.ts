import type {TagWriteRequestDto} from "@/core/runtime";

/**
 * Запись значений тегов в ПЛК (`/api/runtime/tags/write`).
 *
 * Отдаёт сам ответ: разбор у «Опций» и «Инспектора» разный (таймаут, поля причины отказа),
 * и он остаётся у вызывающего.
 */
export function postTagWrites(payload: TagWriteRequestDto, init?: {signal?: AbortSignal}) {
  return fetch("/api/runtime/tags/write", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
    signal: init?.signal,
  });
}
