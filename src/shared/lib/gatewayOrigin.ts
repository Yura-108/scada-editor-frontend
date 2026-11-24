/**
 * Адрес gateway для БРАУЗЕРНЫХ подключений (WebSocket монитора, STOMP редактора).
 *
 * Хост берётся из адреса страницы, а не зашивается: фронт (:3000) и gateway (:8080) — разные
 * порты одного хоста, и `localhost` с любого другого компьютера сети — это сам клиент.
 * `NEXT_PUBLIC_*` вшивается при сборке, а Docker-образ фронта один на все установки, поэтому
 * переменные — только чтобы переопределить.
 *
 * Хост — именно `hostname` страницы: токен едет в cookie `access_token`, а cookie привязаны к
 * хосту без порта, так что `host:3000` и `host:8080` её делят, а `localhost` и `192.168.x.x` — нет.
 *
 * Звать только в браузере (при подключении), не на уровне модуля: при SSR `window` нет.
 * BFF-роуты (`BACKEND_URL`) сюда не относятся — они исполняются на сервере Next.
 */
const GATEWAY_PORT = process.env.NEXT_PUBLIC_GATEWAY_PORT ?? "8080";

/** `http(s)://<хост страницы>:<порт gateway>`. */
export function gatewayHttpOrigin(): string {
  if (process.env.NEXT_PUBLIC_GATEWAY_URL) return process.env.NEXT_PUBLIC_GATEWAY_URL;
  return `${window.location.protocol}//${window.location.hostname}:${GATEWAY_PORT}`;
}

/** `ws(s)://<хост страницы>:<порт gateway>`. */
export function gatewayWsOrigin(): string {
  if (process.env.NEXT_PUBLIC_RUNTIME_WS_URL) return process.env.NEXT_PUBLIC_RUNTIME_WS_URL;
  const ws = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${ws}//${window.location.hostname}:${GATEWAY_PORT}`;
}
