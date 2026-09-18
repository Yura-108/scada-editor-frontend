import type {ProcedureEvent, ProcedureStatus} from "@/types/recipe.types";
import type {AutomationTaskStatus} from "@/types/automation.types";
import {devLog} from "@/lib/devLog";
/**
 * Транспорт режима монитора (контракт Java-команды от 15.07.2026, детали —
 * PHASE4_RUNTIME_PLAN.md, WP4):
 *
 *  1. POST /api/runtime/sessions {projectId} (через наш BFF, Bearer нужен только
 *     на этом шаге) → {sessionId, wsPath, projectTree, token}. token — тот же JWT
 *     из httpOnly-cookie access_token; BFF отдаёт его в теле ответа, поскольку
 *     дальше сокет открывается напрямую браузером и cookie ему не виден.
 *  2. Raw WebSocket (НЕ SockJS/STOMP!) на GATEWAY + wsPath из ответа.
 *     `wsPath` — `/ws/runtime/<instanceId>/<sessionId>`: экземпляров runtime может быть
 *     несколько, и gateway выбирает нужный по имени экземпляра в пути (список берёт у
 *     runtime раз в 10 с). Собирать путь вручную нельзя, а `sessionId` (`<instanceId>.<uuid>`)
 *     — непрозрачная строка: её только передают обратно, не разбирают.
 *     Рантайм требует JWT в query (?token=…) — заголовок Authorization браузерный
 *     WebSocket слать не умеет; без валидного token соединение закрывается 401.
 *
 * Сессия — НАБЛЮДАТЕЛЬ проекта, а не владелец работы: проект живёт по флагу «в
 * эксплуатации», процедуры и состояние свойств принадлежат ему и идут без единого
 * открытого монитора. Уход со страницы снимает только подписку на кадры.
 *
 * Свойства сессии: реконнект заново делает POST (новый sessionId); heartbeat на сервере
 * нет — шлём клиентский ping (неизвестные типы сервер молча игнорирует); ответ на ACTION
 * минует батч и несёт `tags: null` — нормализация `?? []` обязательна. Первый кадр после
 * подключения — `SNAPSHOT`, дальше привычные `UPDATE`.
 */

/** quality отсутствует или "GOOD" — значение достоверно; любое другое — нет
 *  (не сравнивать на равенство "BAD" — контракт расширяемый, см. docs/contract/TAG_CONTRACT_CHANGES.md). */
export type RuntimeTagUpdate = {tagId: string; value: string | null; ts?: number; quality?: string};
/** propertyName — имя свойства компонента; propertyId нестабилен
 *  между пересохранениями таблицы, маршрутизация строк таблицы должна идти по имени. */
export type RuntimePropertyUpdate = {propertyId: number; propertyName: string; value: unknown; ts?: number};
/** rejected — окончательный отказ: код закрытия 1003 (сессия уже занята другим соединением
 *  либо неизвестна) или 409 на создание сессии (проект не в эксплуатации). Реконнект в
 *  этих случаях бессмысленен и лишь прятал бы причину за «Переподключение…». */
export type RuntimeStatus = "connecting" | "live" | "reconnecting" | "closed" | "rejected";

export interface RuntimeConnectionHandlers {
  onUpdate: (
    tags: RuntimeTagUpdate[],
    properties: RuntimePropertyUpdate[],
    procedures: ProcedureEvent[],
  ) => void;
  /**
   * Первый кадр после подключения: всё состояние проекта на этот момент.
   *
   * Проект работает и без наблюдателей, поэтому открывший монитор приходит в середину
   * процесса и без снимка видел бы пустой экран до следующего изменения — у долгого шага
   * мойки это десятки минут. Дубль с последующими `UPDATE` безвреден: значение
   * перезаписывается по ключу.
   */
  onSnapshot?: (
    tags: RuntimeTagUpdate[],
    properties: RuntimePropertyUpdate[],
    procedures: ProcedureStatus[],
  ) => void;
  /** detail — причина для "rejected" (e.reason из close-события либо текст отказа сессии). */
  onStatus?: (status: RuntimeStatus, detail?: string) => void;
  /** Статусы задач automation — приходят только после subscribeTasks(). */
  onTasks?: (tasks: AutomationTaskStatus[]) => void;
}

export interface RuntimeConnection {
  close: () => void;
  /** Триггер серверного Java-скрипта: {"type":"ACTION","scriptId"} (задел Phase C). */
  sendAction: (scriptId: number) => void;
  /** {"type":"SUBSCRIBE_TASKS"} — сервер пришлёт полный список статусов, дальше изменения. */
  subscribeTasks: () => void;
  unsubscribeTasks: () => void;
  /** id текущей сессии (для GET /snapshot) — null, если сокет ещё не подключён/уже закрыт.
   *  Меняется при каждом (ре)коннекте, поэтому это геттер, а не статичное поле. */
  getSessionId: () => string | null;
}

/**
 * Адрес GATEWAY, не самого рантайма: экземпляр выбирается по `instanceId` в `wsPath`,
 * и прямое подключение к сервису (:8085) попадёт не в тот экземпляр — соединение
 * закроется кодом 1003 «Session belongs to instance …».
 */
const RUNTIME_WS_ORIGIN =
  process.env.NEXT_PUBLIC_RUNTIME_WS_URL ?? "ws://localhost:8080";

/** Причина отказа из тела ответа рантайма: у него это всегда поле `message`. */
const messageOf = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const message = (body as {message?: unknown} | null)?.message;
  return typeof message === "string" && message ? message : fallback;
};

const PING_INTERVAL_MS = 20_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

const log = (...args: unknown[]) => devLog("[monitor:ws]", ...args);

export function openRuntimeConnection(
  projectId: number,
  {onUpdate, onStatus, onTasks, onSnapshot}: RuntimeConnectionHandlers,
): RuntimeConnection {
  let ws: WebSocket | null = null;
  let closed = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  let firstConnect = true;
  let currentSessionId: string | null = null;
  // Подписка живёт на соединении, а не на сессии runtime: после переподключения новая сессия
  // о ней не знает, поэтому onopen отправляет SUBSCRIBE_TASKS заново.
  let tasksWanted = false;

  const setStatus = (s: RuntimeStatus, detail?: string) => onStatus?.(s, detail);

  const stopPing = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  /** `detail` — причина паузы (например, недоступный экземпляр): её показывает монитор. */
  const scheduleReconnect = (detail?: string) => {
    if (closed || reconnectTimer) return;
    setStatus("reconnecting", detail);
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

      // 409 — состояние, а не сбой связи: проект не введён в эксплуатацию либо не назначен
      // ни одному экземпляру runtime. Повторные попытки ничего не изменят, пока человек не
      // выставит флаг или не раздаст назначение, поэтому реконнект не запускаем. Разные 409
      // различаются только текстом — показываем его как есть, не подменяя своим.
      if (res.status === 409) {
        const message = await messageOf(res, "Проект недоступен для мониторинга");
        log(`сессия отклонена: ${message} — реконнект не запускаю`);
        if (!closed) setStatus("rejected", message);
        return;
      }

      // 503 — экземпляр, на котором работает проект, недоступен или неизвестен. В отличие
      // от 409 это временно: экземпляр могут поднять, и проект подхватится сам. Повторяем
      // с обычной паузой, но с причиной на экране — без неё оператор видит голое
      // «Переподключение…» и не понимает, что чинить не у него.
      if (res.status === 503) {
        const message = await messageOf(res, "Сервер исполнения недоступен");
        log(`экземпляр недоступен: ${message} — повторю с паузой`);
        scheduleReconnect(message);
        return;
      }

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
      if (tasksWanted) socket.send(JSON.stringify({type: "SUBSCRIBE_TASKS"}));
    };

    socket.onmessage = (e) => {
      let msg: {
        type?: string;
        tags?: RuntimeTagUpdate[] | null;
        properties?: RuntimePropertyUpdate[] | null;
        // В UPDATE — события хода рецепта, в SNAPSHOT — статусы активных процедур проекта.
        procedures?: ProcedureEvent[] | ProcedureStatus[] | null;
        // Статусы задач automation — только после SUBSCRIBE_TASKS.
        tasks?: AutomationTaskStatus[] | null;
      };
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        console.warn("[monitor:ws] битый JSON в сообщении, игнорирую:", e.data);
        return;
      }
      if (msg?.type === "SNAPSHOT") {
        const tags = msg.tags ?? [];
        const properties = msg.properties ?? [];
        const procedures = (msg.procedures ?? []) as ProcedureStatus[];
        log(
          `SNAPSHOT — тегов: ${tags.length}, свойств: ${properties.length},`
          + ` активных процедур: ${procedures.length}`,
        );
        onSnapshot?.(tags, properties, procedures);
        return;
      }
      if (msg?.type !== "UPDATE") {
        log(`сообщение неизвестного типа «${msg?.type}», игнорирую`);
        return;
      }
      // Ответ на ACTION приходит с tags === null (не []) — нормализация обязательна.
      const tags = msg.tags ?? [];
      const properties = msg.properties ?? [];
      const procedures = msg.procedures ?? [];
      if (tags.length || properties.length || procedures.length) {
        console.groupCollapsed(
          `[monitor:ws] UPDATE — тегов: ${tags.length}, свойств: ${properties.length},`
          + ` событий процедуры: ${procedures.length}`,
        );
        if (tags.length) console.table(tags);
        if (properties.length) console.table(properties);
        if (procedures.length) console.table(procedures);
        console.groupEnd();
      }
      onUpdate(tags, properties, procedures as ProcedureEvent[]);
      if (msg.tasks?.length) onTasks?.(msg.tasks);
    };

    socket.onclose = (e) => {
      stopPing();
      if (ws === socket) ws = null;
      // Наблюдатель снят, и следующий коннект получит НОВЫЙ sessionId — по старому
      // `GET /sessions/{id}/snapshot` уже не ответит. Сама работа проекта продолжается.
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
      // Best-effort снятие наблюдателя — до этого брошенная сессия продолжает копить
      // значения тегов в буфер. Процедуры и состояние проекта это НЕ останавливает:
      // мойка идёт дальше, гасит проект только снятие флага «в эксплуатации».
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
    subscribeTasks: () => {
      tasksWanted = true;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: "SUBSCRIBE_TASKS"}));
    },
    unsubscribeTasks: () => {
      tasksWanted = false;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: "UNSUBSCRIBE_TASKS"}));
    },
  };
}
