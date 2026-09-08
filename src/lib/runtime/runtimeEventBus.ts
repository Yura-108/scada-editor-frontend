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

/**
 * Прямой запуск серверного Java-скрипта компонента по имени — пункт меню монитора
 * («действия», помеченные `ElementScript.displayed`). Тот же путь, что и
 * runScript("Имя") внутри обработчика события: движок ищет скрипт у элемента и шлёт
 * ACTION по WS. Отдельная шина, а не ElementEventName: у действия нет события-повода.
 */
type ScriptHandler = (elementKey: string, scriptName: string) => void;

let scriptHandler: ScriptHandler | null = null;

export const setRuntimeScriptHandler = (h: ScriptHandler | null): void => {
  scriptHandler = h;
};

export const emitRuntimeScript = (elementKey: string, scriptName: string): void => {
  scriptHandler?.(elementKey, scriptName);
};

/**
 * Живо ли соединение с рантаймом. Нужно интерфейсу вне движка (пункты меню монитора
 * дизейблятся, пока ACTION уходить некуда), а статус движка не лежит ни в сторе, ни в
 * пропсах холста.
 */
let live = false;

export const setRuntimeLive = (value: boolean): void => {
  live = value;
};

export const isRuntimeLive = (): boolean => live;

/**
 * Текущее значение тега, каким его видит схема. Значения живут в рефах движка
 * (`valuesRef`), а не в сторе, поэтому окну «Опции» нужен геттер, а не селектор:
 * там показывается ровно то же, что нарисовано на холсте, без лишних запросов.
 */
type ValueGetter = (tagId: string) => string | null | undefined;

let valueGetter: ValueGetter | null = null;

export const setRuntimeValueGetter = (g: ValueGetter | null): void => {
  valueGetter = g;
};

export const getRuntimeTagValue = (tagId: string): string | null | undefined =>
  valueGetter?.(tagId);

/**
 * «Значения записаны в ПЛК» — окно «Опции» сообщает движку, что команда ушла.
 *
 * Записанное значение вливается в общий поток значений ОДИН раз, наравне с телеметрией:
 * оператор сразу видит, что команда отправлена, а первый же кадр по этому тегу забирает
 * показ обратно. Экранной «подмены», переживающей телеметрию, больше нет — тег после
 * записи волен меняться скриптом, другим оператором или самим контроллером.
 */
type TagWriteHandler = (writes: {tagId: string; value: string}[]) => void;

let tagWriteHandler: TagWriteHandler | null = null;

export const setRuntimeTagWriteHandler = (h: TagWriteHandler | null): void => {
  tagWriteHandler = h;
};

export const notifyRuntimeTagsWritten = (writes: {tagId: string; value: string}[]): void => {
  if (writes.length) tagWriteHandler?.(writes);
};

/**
 * id текущей рантайм-сессии. Нужен окну «Опции», чтобы отправить запись значения:
 * сессия живёт внутри движка и меняется при каждом переподключении, поэтому геттер,
 * а не значение.
 */
type SessionGetter = () => string | null;

let sessionGetter: SessionGetter | null = null;

export const setRuntimeSessionGetter = (g: SessionGetter | null): void => {
  sessionGetter = g;
};

export const getRuntimeSessionId = (): string | null => sessionGetter?.() ?? null;
