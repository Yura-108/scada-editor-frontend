/**
 * Отладочный вывод, который не доживает до продакшена.
 *
 * Логирование рантайма (WebSocket, движок привязок) полезно при разработке, но
 * без этого guard'а оно писалось в консоль пользователя на каждое сообщение с
 * сервера — вместе с содержимым событий.
 */
export const isDev = process.env.NODE_ENV !== 'production';

export const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

/** Ключ `localStorage`, включающий подробный вывод рантайма (см. `isRuntimeTraceOn`). */
export const RUNTIME_TRACE_KEY = 'scada:runtime-trace';

let runtimeTrace: boolean | null = null;

/**
 * Подробный вывод рантайма: таблицы на каждый кадр WS и каждый такт движка.
 *
 * Только при разработке и только по флагу — `localStorage.setItem('scada:runtime-trace', '1')`
 * и перезагрузка страницы. Без флага `npm run dev` печатал таблицу на сотни тегов по
 * несколько раз в секунду: консоль держала копии значений в памяти, а монитор в dev-режиме
 * выглядел заметно медленнее, чем он есть. Флаг читается один раз за загрузку страницы —
 * вызов стоит на пути каждого кадра.
 */
export const isRuntimeTraceOn = (): boolean => {
  if (!isDev) return false;
  if (runtimeTrace === null) {
    try {
      runtimeTrace = typeof localStorage !== 'undefined' && localStorage.getItem(RUNTIME_TRACE_KEY) === '1';
    } catch {
      // Хранилище недоступно (приватный режим, запрет в настройках) — значит, без вывода.
      runtimeTrace = false;
    }
  }
  return runtimeTrace;
};
