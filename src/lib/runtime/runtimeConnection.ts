/**
 * Транспорт режима монитора (контракт Java-команды от 15.07.2026, детали —
 * PHASE4_RUNTIME_PLAN.md, WP4):
 *
 *  1. POST /api/runtime/sessions {projectId} (через наш BFF, Bearer нужен только
 *     на этом шаге) → {sessionId, wsPath, projectTree, token}. token — тот же JWT
 *     из httpOnly-cookie access_token; BFF отдаёт его в теле ответа, поскольку
 *     дальше сокет открывается напрямую браузером и cookie ему не виден.
 *  2. Raw WebSocket (НЕ SockJS/STOMP!) на рантайм-сервис `ws://…:8085` + wsPath.
 *     Gateway роутит только /api/** — wsPath НЕЛЬЗЯ клеить к origin gateway.
 *     Рантайм требует JWT в query (?token=…) — заголовок Authorization браузерный
 *     WebSocket слать не умеет; без валидного token соединение закрывается 401.
 *
 * Свойства сессии: обрыв WS убивает её на сервере — реконнект обязан заново
 * делать POST (новый sessionId); heartbeat на сервере нет — шлём клиентский ping
 * (неизвестные типы сервер молча игнорирует); ответ на ACTION минует батч и несёт
 * `tags: null` — нормализация `?? []` обязательна.
 */

export type RuntimeTagUpdate = {tagId: string; value: string; ts?: number};
/** propertyName — имя свойства (== row_name строки таблицы); propertyId нестабилен
 *  между пересохранениями таблицы, маршрутизация строк таблицы должна идти по имени. */
export type RuntimePropertyUpdate = {propertyId: number; propertyName: string; value: unknown; ts?: number};
/** rejected — окончательный отказ хендшейка (код закрытия 1003: сессия уже занята
 *  другим соединением, либо неизвестна) — реконнект в этом случае бессмысленен. */
export type RuntimeStatus = "connecting" | "live" | "reconnecting" | "closed" | "rejected";

export interface RuntimeConnectionHandlers {
  onUpdate: (tags: RuntimeTagUpdate[], properties: RuntimePropertyUpdate[]) => void;
  /** detail — причина для "rejected" (e.reason из close-события). */
  onStatus?: (status: RuntimeStatus, detail?: string) => void;
}

export interface RuntimeConnection {
  close: () => void;
  /** Триггер серверного Java-скрипта: {"type":"ACTION","scriptId"} (задел Phase C). */
  sendAction: (scriptId: number) => void;
  /** id текущей сессии (для GET /snapshot) — null, если сокет ещё не подключён/уже закрыт.
   *  Меняется при каждом (ре)коннекте, поэтому это геттер, а не статичное поле. */
  getSessionId: () => string | null;
}

const RUNTIME_WS_ORIGIN =
  process.env.NEXT_PUBLIC_RUNTIME_WS_URL ?? "ws://localhost:8080";

const PING_INTERVAL_MS = 20_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

const log = (...args: unknown[]) => console.log("[monitor:ws]", ...args);

export function openRuntimeConnection(
  projectId: number,
  {onUpdate, onStatus}: RuntimeConnectionHandlers,
): RuntimeConnection {
  let ws: WebSocket | null = null;
  let closed = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  let firstConnect = true;
  let currentSessionId: string | null = null;

  const setStatus = (s: RuntimeStatus, detail?: string) => onStatus?.(s, detail);

  const stopPing = () => {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    setStatus("reconnecting");
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS);
  };

  const connect = async () => {
    if (closed) return;
    setStatus(firstConnect ? "connecting" : "reconnecting");
    log(`создаю сессию для проекта ${projectId}${firstConnect ? "" : " (переподключение)"}...`);
    firstConnect = false;

    // Сессия одноразовая: каждый (ре)коннект начинается с нового POST.
    let wsPath: string;
    let wsToken: string;
    try {
      const res = await fetch("/api/runtime/sessions", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({projectId}),
      });
      if (!res.ok) throw new Error(`POST /api/runtime/sessions → ${res.status}`);
      const data = await res.json();
      if (typeof data?.wsPath !== "string") throw new Error("В ответе сессии нет wsPath");
      if (typeof data?.token !== "string") throw new Error("В ответе сессии нет token");
      wsPath = data.wsPath;
      wsToken = data.token;
      currentSessionId = typeof data?.sessionId === "string" ? data.sessionId : null;
      log(`сессия ${data.sessionId ?? "?"} создана → подключаюсь к ${RUNTIME_WS_ORIGIN}${wsPath}`);
    } catch (err) {
      console.warn("[monitor:ws] не удалось создать рантайм-сессию:", err);
      scheduleReconnect();
      return;
    }
    if (closed) return;

    // Браузерный WebSocket не умеет слать заголовок Authorization — JWT идёт query-параметром.
    const separator = wsPath.includes("?") ? "&" : "?";
    const socket = new WebSocket(`${RUNTIME_WS_ORIGIN}${wsPath}${separator}token=${encodeURIComponent(wsToken)}`);
    ws = socket;

    socket.onopen = () => {
      if (closed) { socket.close(); return; }
      reconnectDelay = 1000;
      setStatus("live");
      log("соединение открыто, статус: live");
      // Сервер молча игнорирует неизвестные типы — ping держит соединение
      // живым при редких тегах/прокси (heartbeat на сервере не реализован).
      stopPing();
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({type: "PING"}));
        }
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (e) => {
      let msg: {type?: string; tags?: RuntimeTagUpdate[] | null; properties?: RuntimePropertyUpdate[] | null};
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        console.warn("[monitor:ws] битый JSON в сообщении, игнорирую:", e.data);
        return;
      }
      if (msg?.type !== "UPDATE") {
        log(`сообщение неизвестного типа «${msg?.type}», игнорирую`);
        return;
      }
      // Ответ на ACTION приходит с tags === null (не []) — нормализация обязательна.
      const tags = msg.tags ?? [];
      const properties = msg.properties ?? [];
      if (tags.length || properties.length) {
        console.groupCollapsed(
          `[monitor:ws] UPDATE — тегов: ${tags.length}, свойств: ${properties.length}`,
        );
        if (tags.length) console.table(tags);
        if (properties.length) console.table(properties);
        console.groupEnd();
      }
      onUpdate(tags, properties);
    };

    socket.onclose = (e) => {
      stopPing();
      if (ws === socket) ws = null;
      // Сессия умирает на сервере вместе с сокетом — snapshot по старому id больше не ответит.
      currentSessionId = null;

      // 1003 — окончательный отказ (у сессии уже есть живое соединение, либо она
      // неизвестна/закрыта): реконнект-цикл тут будет крутиться вечно без толку.
      if (e.code === 1003) {
        log(`соединение отклонено (code=1003${e.reason ? `, reason="${e.reason}"` : ""}) — реконнект не запускаю`);
        if (!closed) setStatus("rejected", e.reason);
        return;
      }

      if (!closed) {
        log(`соединение закрыто (code=${e.code}${e.reason ? `, reason="${e.reason}"` : ""}) — переподключаюсь через ${reconnectDelay}мс`);
      }
      // Сессия умерла на сервере — переподключение только через новый POST
      // (который заодно берёт свежий токен из cookie).
      scheduleReconnect();
    };
  };

  void connect();

  return {
    close: () => {
      log("закрываю соединение по запросу (выход из монитора/смена проекта)");
      closed = true;
      stopPing();
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      // Best-effort явное закрытие сессии на бэкенде — до этого брошенная сессия
      // продолжает получать значения тегов в буфер (reaper подберёт её не сразу).
      // Не await'им (не блокируем закрытие сокета/уход со страницы), keepalive
      // переживает unload; ошибка ничего не ломает на клиенте.
      if (currentSessionId) {
        const sessionId = currentSessionId;
        fetch(`/api/runtime/sessions/${sessionId}`, {method: "DELETE", keepalive: true}).catch(() => {});
      }
      ws?.close();
      ws = null;
      currentSessionId = null;
      setStatus("closed");
    },
    sendAction: (scriptId: number) => {
      if (ws?.readyState === WebSocket.OPEN) {
        log(`ACTION → scriptId=${scriptId}`);
        ws.send(JSON.stringify({type: "ACTION", scriptId}));
      } else {
        console.warn(`[monitor:ws] sendAction(${scriptId}) проигнорирован — соединение не открыто`);
      }
    },
    getSessionId: () => currentSessionId,
  };
}
