/// <reference lib="webworker" />

/**
 * Что отнять у пользовательского кода в воркере-песочнице до первого запуска.
 *
 * Сеть: страница ходит в `/api/...` с cookie пользователя, и скрипт схемы мог бы сделать то же
 * от имени того, кто открыл схему (#20 п. 1). Канал к странице: со своим `postMessage` скрипт
 * подделал бы ответ — например, лишний `runScript`, который страница отправила бы с правами
 * оператора. Таймеры не трогаем: они безвредны, а отложенный вызов всё равно придёт после ответа.
 *
 * Это второй слой. Первый — CSP самого воркера (`connect-src 'none'`, `script-src` без адресов —
 * закрывает и `import()`, который отсюда не отнять: `Function` нужен для компиляции и достаётся из
 * любой функции). Её отдаёт заголовок ответа со скриптом воркера (шаг 5 плана).
 */
const BLOCKED = [
  // сеть
  "fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "EventSource", "WebTransport",
  "RTCPeerConnection", "importScripts",
  // хранилища и каналы между вкладками
  "indexedDB", "caches", "BroadcastChannel",
  // свои потоки — в них запреты не действовали бы
  "Worker", "SharedWorker",
  // канал к странице: ответы шлёт только хост воркера, захвативший его заранее
  "postMessage", "onmessage", "onmessageerror", "addEventListener", "removeEventListener", "dispatchEvent",
  "close",
] as const;

export function lockDownWorkerScope(scope: object) {
  // Свойство может лежать на самом объекте и на любом прототипе цепочки
  // (DedicatedWorkerGlobalScope → WorkerGlobalScope → EventTarget): снимаем везде.
  for (let target: object | null = scope; target && target !== Object.prototype; target = Object.getPrototypeOf(target)) {
    for (const name of BLOCKED) {
      const desc = Object.getOwnPropertyDescriptor(target, name);
      if (!desc) continue;
      if (desc.configurable) Reflect.deleteProperty(target, name);
      else if (desc.writable) Reflect.set(target, name, undefined);
    }
  }
  // Вернуть удалённое нельзя: на самом объекте ставим пустое неизменяемое свойство.
  for (const name of BLOCKED) {
    try {
      Object.defineProperty(scope, name, {value: undefined, writable: false, configurable: false});
    } catch {
      // уже неизменяемое — оставляем как есть
    }
  }
}
