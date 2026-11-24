import {isSaveConflictBody, SaveConflictError} from "@/core/project";
import type {PaletteItemResponseDTO} from "../types/palette.types";

/**
 * Разбирает ответ и бросает ошибку с сообщением бэкенда, если статус не 2xx.
 *
 * Без этой проверки тело ошибки 4xx/5xx парсилось как обычный DTO и попадало в
 * список палитры записью с `id: undefined`, а пользователь видел «успешно».
 *
 * 409 выделен отдельным типом ошибки: расхождение версий — не сбой сохранения, а
 * ситуация, в которой решает человек, и показывать её надо сравнением, а не тостом.
 */
const parseOk = async <T>(res: Response, fallback: string): Promise<T> => {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // не-JSON — сообщение возьмём из текста
  }

  if (res.status === 409 && isSaveConflictBody(body)) {
    throw new SaveConflictError(body);
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && typeof (body as {message?: unknown}).message === "string"
        ? (body as {message: string}).message
        : "") || text.slice(0, 200) || `${fallback} (${res.status})`;
    throw new Error(message);
  }

  return body as T;
};

/** Тело создания и правки шаблона: у шаблона конверта нет, поля версионирования едут рядом. */
export interface PaletteItemWriteDTO {
  name: string;
  type: string;
  rootComponent: unknown;
  save_kind: "MANUAL";
  based_on_version?: number;
}

export async function fetchPaletteTemplates(): Promise<PaletteItemResponseDTO[]> {
  const res = await fetch("/api/editor/palette/");
  return (await parseOk<PaletteItemResponseDTO[]>(res, "Ошибка загрузки списка элементов")) ?? [];
}

export async function requestCreateTemplate(dto: PaletteItemWriteDTO): Promise<PaletteItemResponseDTO> {
  const res = await fetch("/api/editor/palette/", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(dto),
  });
  return parseOk<PaletteItemResponseDTO>(res, "Ошибка сохранения шаблона");
}

export async function requestUpdateTemplate(id: number, dto: PaletteItemWriteDTO): Promise<PaletteItemResponseDTO> {
  const res = await fetch(`/api/editor/palette/${id}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(dto),
  });
  return parseOk<PaletteItemResponseDTO>(res, "Ошибка обновления шаблона");
}

/** Удаление шаблона; причина отказа — из поля `error` тела. */
export async function requestDeleteTemplate(id: number): Promise<void> {
  const res = await fetch(`/api/editor/palette/${id}`, {method: "DELETE"});
  if (!res.ok) {
    const err = await res.json().catch(() => {}) as {error?: string} | undefined;
    throw new Error(err?.error || "Ошибка удаления");
  }
}
