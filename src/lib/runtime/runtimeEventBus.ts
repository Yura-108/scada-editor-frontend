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
 * Просьба пересоздать сессию рантайма: сцена на сервере изменилась (переназначили
 * тег свойству) и сессию нужно скомпилировать заново — старая продолжает работать
 * по прежнему тегу. Подписчик один — useRuntimeEngine.
 */
type RestartHandler = () => void;

let restartHandler: RestartHandler | null = null;

export const setRuntimeRestartHandler = (h: RestartHandler | null): void => {
  restartHandler = h;
};

export const requestRuntimeRestart = (): void => {
  restartHandler?.();
};
