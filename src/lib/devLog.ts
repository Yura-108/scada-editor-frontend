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
