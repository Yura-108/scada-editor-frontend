import type {
  BindingRunResult, EventRunResult, SandboxBinding, SandboxEvent, SandboxRequest, SandboxResponse, SandboxScripts,
  SandboxValues,
} from "./protocol";

/**
 * Хост воркера-песочницы скриптов схем на странице (#20 п. 1, план —
 * `docs/plan-2026-11-04-script-sandbox.md`).
 *
 * Каждый запрос — под сторожем: нет ответа за отведённое время — воркер убивается и поднимается
 * заново с последней загруженной схемой и значениями, а запрос отклоняется `SandboxTimeoutError`.
 * Время считается с момента, когда воркер взялся за запрос, а не с отправки (см. `arm`).
 * Раньше `while (true) {}` в привязке вешал весь монитор; решать, что делать с виновным скриптом
 * (отключить и загрузить схему без него), — вызывающему, по `ids` в ошибке.
 *
 * Ответ со старым `generation` (после смены схемы) — `null`: такой результат применять нельзя.
 */

export const SANDBOX_TIMEOUTS = {load: 2000, bindings: 200, event: 1000, test: 1000} as const;

/** Запрос не уложился в срок: воркер перезапущен. `ids` — скрипты этого запроса. */
export class SandboxTimeoutError extends Error {
  constructor(readonly request: SandboxRequest["type"], readonly ids: string[]) {
    super(`Скрипт схемы не ответил вовремя (${request}), песочница перезапущена`);
    this.name = "SandboxTimeoutError";
  }
}

/** Запрос потерян при перезапуске воркера из-за чужого зависания или сбоя. */
export class SandboxRestartedError extends Error {
  constructor() {
    super("Песочница скриптов перезапущена");
    this.name = "SandboxRestartedError";
  }
}

export interface ScriptSandbox {
  load(generation: number, scripts: SandboxScripts): Promise<{id: string; error: string}[] | null>;
  setValues(generation: number, values: SandboxValues): void;
  runBindings(generation: number, items: {id: string; self: unknown}[]): Promise<BindingRunResult[] | null>;
  runEvent(generation: number, id: string, self: unknown): Promise<EventRunResult | null>;
  testBinding(binding: SandboxBinding, values: SandboxValues, self: unknown): Promise<BindingRunResult>;
  testEvent(event: SandboxEvent, values: SandboxValues, self: unknown): Promise<EventRunResult>;
  /**
   * Разовый прогон обработчика в мониторе — по клику, со значениями скоупа на момент клика.
   * То же, что `testEvent`, но со сроком `event`: обработчик компилируется на каждый клик и
   * раньше, загружать события схемы заранее незачем.
   */
  runEventOnce(event: SandboxEvent, values: SandboxValues, self: unknown): Promise<EventRunResult>;
  dispose(): void;
}

interface Pending {
  type: SandboxRequest["type"];
  ids: string[];
  timeoutMs: number;
  /** `null` — запрос ещё в очереди воркера: сторож взводится, когда до него дойдёт дело. */
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (msg: SandboxResponse) => void;
  reject: (err: Error) => void;
}

const noop = () => {};

/**
 * Воркер — отдельный файл (`scripts/build-sandbox-worker.mjs`), а не `new URL(…, import.meta.url)`:
 * у него своя политика безопасности из заголовка ответа (`next.config.ts` — без сети и `import()`),
 * а воркер из blob-URL, как его создаёт Turbopack, унаследовал бы политику страницы.
 */
export const SANDBOX_WORKER_URL = "/sandbox/worker.js";

const defaultWorker = () => new Worker(SANDBOX_WORKER_URL, {name: "script-sandbox"});

export function createScriptSandbox({createWorker = defaultWorker}: {createWorker?: () => Worker} = {}): ScriptSandbox {
  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<number, Pending>();
  // Чем поднять воркер заново: последняя схема и все значения, пришедшие к ней.
  let lastLoad: {generation: number; scripts: SandboxScripts} | null = null;
  const tags = new Map<string, string | null>();
  const props = new Map<number, string>();
  let disposed = false;

  const snapshot = (): SandboxValues => ({tags: [...tags], props: [...props]});

  /**
   * Взводит сторож первому запросу в очереди — тому, над которым воркер работает сейчас.
   *
   * Воркер отвечает строго по очереди, а срок запроса — это срок его ИСПОЛНЕНИЯ. Пока сторож
   * взводился при отправке, прогон привязок, ушедший сразу за загрузкой схемы, тратил свои
   * 200 мс на её компиляцию: на большой схеме он «зависал», ни разу не начавшись, воркер
   * убивался, и здоровые привязки отключались как зависшие. `pending` хранит порядок отправки
   * (`Map`), поэтому первый в нём — текущий.
   */
  const arm = () => {
    const head = pending.entries().next();
    if (head.done) return;
    const [key, p] = head.value;
    if (p.timer === null) p.timer = setTimeout(() => restart(key), p.timeoutMs);
  };

  const settle = (key: number, msg: SandboxResponse) => {
    const p = pending.get(key);
    if (!p) return;
    if (p.timer !== null) clearTimeout(p.timer);
    pending.delete(key);
    p.resolve(msg);
    arm();
  };

  const onMessage = (e: MessageEvent<SandboxResponse>) => {
    const msg = e.data;
    if (msg.type === "loaded") settle(-msg.generation, msg);
    else settle(msg.requestId, msg);
  };

  const restart = (culprit: number | null) => {
    worker?.terminate();
    worker = null;
    for (const [key, p] of pending) {
      if (p.timer !== null) clearTimeout(p.timer);
      p.reject(key === culprit ? new SandboxTimeoutError(p.type, p.ids) : new SandboxRestartedError());
    }
    pending.clear();
    if (disposed || !lastLoad) return;
    // Схема и значения — заново. Ответ на эту загрузку никто не ждёт, но в очереди она стоит:
    // запросы, отправленные следом, не должны тратить свой срок на запуск воркера и компиляцию.
    pending.set(-lastLoad.generation, {
      type: "load", ids: [], timeoutMs: SANDBOX_TIMEOUTS.load, timer: null, resolve: noop, reject: noop,
    });
    ensure().postMessage({type: "load", ...lastLoad} satisfies SandboxRequest);
    ensure().postMessage({type: "values", generation: lastLoad.generation, values: snapshot()} satisfies SandboxRequest);
    arm();
  };

  const ensure = (): Worker => {
    if (disposed) throw new Error("Песочница скриптов закрыта");
    if (!worker) {
      worker = createWorker();
      worker.addEventListener("message", onMessage);
      // Сбой самого воркера (не скрипта — те ловит try/catch внутри) — тот же перезапуск.
      worker.addEventListener("error", () => restart(null));
    }
    return worker;
  };

  /** Отправить и ждать ответа под сторожем. `key` — requestId или −generation для `load`. */
  const request = (key: number, msg: SandboxRequest, ids: string[], timeoutMs: number) =>
    new Promise<SandboxResponse>((resolve, reject) => {
      pending.set(key, {type: msg.type, ids, timeoutMs, timer: null, resolve, reject});
      try {
        ensure().postMessage(msg);
      } catch (err) {
        // Не клонируется (`self` с функцией) или песочница закрыта: ответа не будет, и сторож
        // не должен принять это за зависание.
        pending.delete(key);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
      arm();
    });

  const oneShotEvent = async (event: SandboxEvent, values: SandboxValues, self: unknown, timeoutMs: number) => {
    const requestId = nextId++;
    const res = await request(requestId, {type: "testEvent", requestId, event, values, self}, [event.id], timeoutMs);
    if (res.type !== "testEventResult") throw new Error("Неожиданный ответ песочницы");
    return res.result;
  };

  return {
    async load(generation, scripts) {
      lastLoad = {generation, scripts};
      tags.clear();
      props.clear();
      const ids = [...scripts.bindings.map(b => b.id), ...scripts.events.map(e => e.id)];
      const res = await request(-generation, {type: "load", generation, scripts}, ids, SANDBOX_TIMEOUTS.load);
      return res.type === "loaded" && res.generation === lastLoad?.generation ? res.errors : null;
    },
    setValues(generation, values) {
      if (generation !== lastLoad?.generation) return;
      for (const [id, v] of values.tags) tags.set(id, v);
      for (const [id, v] of values.props) {
        if (v === null) props.delete(id); else props.set(id, v);
      }
      ensure().postMessage({type: "values", generation, values} satisfies SandboxRequest);
    },
    async runBindings(generation, items) {
      if (generation !== lastLoad?.generation) return null;
      const requestId = nextId++;
      const res = await request(requestId, {type: "runBindings", generation, requestId, items},
        items.map(i => i.id), SANDBOX_TIMEOUTS.bindings);
      return res.type === "bindingsResult" && res.generation === lastLoad?.generation ? res.results : null;
    },
    async runEvent(generation, id, self) {
      if (generation !== lastLoad?.generation) return null;
      const requestId = nextId++;
      const res = await request(requestId, {type: "runEvent", generation, requestId, id, self}, [id], SANDBOX_TIMEOUTS.event);
      return res.type === "eventResult" && res.generation === lastLoad?.generation ? res.result : null;
    },
    async testBinding(binding, values, self) {
      const requestId = nextId++;
      const res = await request(requestId, {type: "testBinding", requestId, binding, values, self}, [binding.id], SANDBOX_TIMEOUTS.test);
      if (res.type !== "testBindingResult") throw new Error("Неожиданный ответ песочницы");
      return res.result;
    },
    testEvent: (event, values, self) => oneShotEvent(event, values, self, SANDBOX_TIMEOUTS.test),
    runEventOnce: (event, values, self) => oneShotEvent(event, values, self, SANDBOX_TIMEOUTS.event),
    dispose() {
      disposed = true;
      restart(null);
    },
  };
}
