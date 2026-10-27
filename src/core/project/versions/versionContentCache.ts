import type {VersionDocType} from "@/types/editorVersion.types";
import {fetchVersionContent} from "./versionsApi";

/**
 * Содержимое версий для просмотра истории. Версия неизменна, поэтому кэш живёт всё время
 * жизни вкладки: раскрыть ту же версию повторно, сравнить её с соседней или показать перед
 * восстановлением — без повторных запросов.
 */
const cache = new Map<string, Promise<unknown>>();

export const loadVersionContent = (docType: VersionDocType, id: number, versionNo: number): Promise<unknown> => {
  const key = `${docType}:${id}:${versionNo}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchVersionContent(docType, id, versionNo);
    // Неудачу не запоминаем: следующая попытка пойдёт в сеть снова.
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
};
