/// <reference lib="webworker" />
import {lockDownWorkerScope} from "./lockdown";
import {compileBinding, executeBinding, type CompiledBinding} from "../script/executeBinding";
import {compileEventScript, executeEventScript, type ActionArgs, type CompiledEventScript} from "../script/eventScript";
import type {
  BindingRunResult, EventRunResult, RunScriptCall, SandboxBinding, SandboxEvent, SandboxRequest, SandboxResponse,
  SandboxValues,
} from "./protocol";

/**
 * Воркер-песочница скриптов схем: привязки и обработчики событий компилируются и выполняются
 * здесь, а не на странице. У воркера нет `document`, `localStorage`, навигации; сеть и
 * `postMessage` у пользовательского кода отняты (`lockDownWorkerScope`). Сами модули скриптов —
 * те же чистые `executeBinding` / `eventScript`, что и раньше; меняется только место исполнения.
 */

// Канал к странице — ДО запрета: у пользовательского кода его уже не будет, и подделать ответ
// (например, лишний `runScript`) скрипт не сможет.
const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = scope.postMessage.bind(scope) as (message: SandboxResponse) => void;
const listen = scope.addEventListener.bind(scope);
lockDownWorkerScope(scope);

let generation = 0;
const bindings = new Map<string, CompiledBinding>();
const events = new Map<string, CompiledEventScript>();
let tagValues = new Map<string, string | null>();
let propValues = new Map<number, string>();

const applyValues = (values: SandboxValues, tags: Map<string, string | null>, props: Map<number, string>) => {
  for (const [id, value] of values.tags) tags.set(id, value);
  for (const [id, value] of values.props) {
    if (value === null) props.delete(id); else props.set(id, value);
  }
};

const compileBindingItem = (b: SandboxBinding) => compileBinding(b.elementKey, b.binding, b.scope);
const compileEventItem = (e: SandboxEvent) => compileEventScript(e.elementKey, e.handler, e.scope);

const runBinding = (
  id: string, cb: CompiledBinding, tags: ReadonlyMap<string, string | null>, props: ReadonlyMap<number, string>, self: unknown,
): BindingRunResult => {
  const res = executeBinding(cb, tags, props, self);
  return "error" in res ? {id, error: res.error} : {id, intents: res.intents};
};

const runEvent = (
  cb: CompiledEventScript, tags: ReadonlyMap<string, string | null>, props: ReadonlyMap<number, string>, self: unknown,
): EventRunResult => {
  // runScript — намерением: ACTION отправит страница, со своими проверками прав и подтверждением.
  const calls: RunScriptCall[] = [];
  const runScript = (name: string, args?: ActionArgs) => { calls.push(args ? {name, args} : {name}); };
  const res = executeEventScript(cb, tags, props, self, runScript);
  return "error" in res ? res : {...res, runScript: calls};
};

const handle = (msg: SandboxRequest) => {
  switch (msg.type) {
    case "load": {
      generation = msg.generation;
      bindings.clear();
      events.clear();
      tagValues = new Map();
      propValues = new Map();
      const errors: {id: string; error: string}[] = [];
      for (const b of msg.scripts.bindings) {
        const c = compileBindingItem(b);
        if ("error" in c) errors.push({id: b.id, error: c.error}); else bindings.set(b.id, c);
      }
      for (const e of msg.scripts.events) {
        const c = compileEventItem(e);
        if ("error" in c) errors.push({id: e.id, error: c.error}); else events.set(e.id, c);
      }
      post({type: "loaded", generation, errors});
      return;
    }
    case "values":
      if (msg.generation === generation) applyValues(msg.values, tagValues, propValues);
      return;
    // Запрос к старой схеме — всё равно ответ (пустой, с ЕГО номером): молчание хост принял бы
    // за зависание и перезапустил воркер.
    case "runBindings": {
      if (msg.generation !== generation) {
        post({type: "bindingsResult", generation: msg.generation, requestId: msg.requestId, results: []});
        return;
      }
      const results: BindingRunResult[] = [];
      for (const {id, self: el} of msg.items) {
        const cb = bindings.get(id);
        results.push(cb ? runBinding(id, cb, tagValues, propValues, el) : {id, error: "привязка не загружена"});
      }
      post({type: "bindingsResult", generation, requestId: msg.requestId, results});
      return;
    }
    case "runEvent": {
      if (msg.generation !== generation) {
        post({type: "eventResult", generation: msg.generation, requestId: msg.requestId, result: {error: "схема сменилась"}});
        return;
      }
      const cb = events.get(msg.id);
      const result: EventRunResult = cb ? runEvent(cb, tagValues, propValues, msg.self) : {error: "обработчик не загружен"};
      post({type: "eventResult", generation, requestId: msg.requestId, result});
      return;
    }
    case "testBinding": {
      const c = compileBindingItem(msg.binding);
      const tags = new Map<string, string | null>();
      const props = new Map<number, string>();
      applyValues(msg.values, tags, props);
      const result: BindingRunResult = "error" in c
        ? {id: msg.binding.id, error: c.error, stage: "compile"}
        : runBinding(msg.binding.id, c, tags, props, msg.self);
      post({type: "testBindingResult", requestId: msg.requestId, result});
      return;
    }
    case "testEvent": {
      const c = compileEventItem(msg.event);
      const tags = new Map<string, string | null>();
      const props = new Map<number, string>();
      applyValues(msg.values, tags, props);
      const result: EventRunResult = "error" in c ? {error: c.error, stage: "compile"} : runEvent(c, tags, props, msg.self);
      post({type: "testEventResult", requestId: msg.requestId, result});
      return;
    }
  }
};

listen("message", (e: MessageEvent<SandboxRequest>) => handle(e.data));
