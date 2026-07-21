import type {ElementEventName} from "@/types/binding.types";

/**
 * Мост «клик по фигуре в мониторе → движок рантайма». Слой интеракции в Canvas
 * (только readOnly) эмитит событие по ключу элемента; движок (useRuntimeEngine)
 * регистрирует обработчик, который компилирует и исполняет `element.events[...]`.
 *
 * Модуль-синглтон, чтобы не тащить функцию через стор/пропсы Konva-дерева.
 * Активен только пока смонтирован движок монитора (в редакторе обработчика нет —
 * emit становится no-op).
 */
type Handler = (elementKey: string, event: ElementEventName) => void;

let handler: Handler | null = null;

export const setRuntimeEventHandler = (h: Handler | null): void => {
  handler = h;
};

export const emitRuntimeEvent = (elementKey: string, event: ElementEventName): void => {
  handler?.(elementKey, event);
};

/** Есть ли активный обработчик (мы в мониторе) — для курсора/подсветки интерактива. */
export const hasRuntimeEventHandler = (): boolean => handler !== null;
