"use client";

import React, {useEffect, useState} from "react";
import {createScriptSandbox, SandboxTimeoutError, type SandboxBinding, type SandboxEvent, type TagScope} from "@/core/runtime";
import {Badge} from "@/shared/ui/Badge";

/** Скоуп из одной тег-переменной `T`. */
const SCOPE: TagScope = {names: ["T"], tagIdByName: {T: "tag.T"}, propertyIdByName: {}, invalidNames: []};
const VALUES = {tags: [["tag.T", "42"]] as [string, string | null][], props: []};

const binding = (id: string, code: string): SandboxBinding =>
  ({id, elementKey: "el", scope: SCOPE, binding: {v: 1, id, name: id, enabled: true, code}});
const event = (id: string, code: string): SandboxEvent => ({id, elementKey: "el", scope: SCOPE, handler: {code}});

type Check = {name: string; run: (sb: ReturnType<typeof createScriptSandbox>) => Promise<string | true>};

/**
 * Что песочница обязана делать: результат — `true` или текст, что пошло не так. Порядок важен:
 * проверка зависания перезапускает воркер, и следующая показывает, что он снова работает.
 */
const CHECKS: Check[] = [
  {name: "Привязка читает тег и выдаёт намерения", run: async sb => {
    const r = await sb.testBinding(binding("b1", 'if (T > 10) setState("Авария"); setProp("color", "red");'), VALUES, null);
    return "intents" in r && JSON.stringify(r.intents).includes("Авария") ? true : JSON.stringify(r);
  }},
  {name: "Обработчик: runScript и openScene — намерениями", run: async sb => {
    const r = await sb.testEvent(event("e1", 'runScript("Пуск", {n: T}); openScene("Схема 2");'), VALUES, null);
    return "runScript" in r && r.runScript[0]?.name === "Пуск" && r.openScene === "Схема 2" ? true : JSON.stringify(r);
  }},
  {name: "Синтаксическая ошибка — этап «компиляция», ошибка в коде — «исполнение»", run: async sb => {
    const bad = await sb.testBinding(binding("bc", "if ("), VALUES, null);
    const thrown = await sb.testBinding(binding("bt", "throw new Error('x')"), VALUES, null);
    return "error" in bad && bad.stage === "compile" && "error" in thrown && thrown.stage !== "compile"
      ? true : JSON.stringify({bad, thrown});
  }},
  {name: "Сети нет: fetch недоступен", run: async sb => {
    const r = await sb.testBinding(binding("b2", 'fetch("/api/auth/me");'), VALUES, null);
    return "error" in r ? true : "fetch сработал";
  }},
  {name: "Обходы запрета не работают: прототипы, XHR, WebSocket, importScripts, свой воркер", run: async sb => {
    const attempts = [
      "Object.getPrototypeOf(self).fetch('/api/auth/me')",
      "Object.getPrototypeOf(Object.getPrototypeOf(self)).fetch('/api/auth/me')",
      "new XMLHttpRequest()",
      "new WebSocket('ws://localhost:8080')",
      "importScripts('/x.js')",
      "new Worker('/x.js')",
      "(function(){}).constructor('return this')().fetch('/api/auth/me')",
    ];
    const passed: string[] = [];
    for (const code of attempts) {
      const r = await sb.testBinding(binding("b-" + passed.length, code), VALUES, null);
      if (!("error" in r)) passed.push(code);
    }
    return passed.length ? `сработало: ${passed.join("; ")}` : true;
  }},
  {name: "Ответ не подделать: postMessage недоступен", run: async sb => {
    const r = await sb.testBinding(binding("b3", 'self.postMessage({type: "testBindingResult", requestId: 0});'), VALUES, null);
    return "error" in r ? true : "postMessage сработал";
  }},
  {name: "Бесконечный цикл: сторож перезапускает воркер", run: async sb => {
    try {
      await sb.testBinding(binding("b4", "while (true) {}"), VALUES, null);
      return "цикл завершился сам";
    } catch (err) {
      return err instanceof SandboxTimeoutError && err.ids.includes("b4") ? true : String(err);
    }
  }},
  {name: "После перезапуска — работает; ответ старой схемы — null", run: async sb => {
    await sb.load(1, {bindings: [binding("b5", 'setState(T > 10 ? "Много" : "Мало")')], events: []});
    sb.setValues(1, VALUES);
    const fresh = await sb.runBindings(1, [{id: "b5", self: null}]);
    await sb.load(2, {bindings: [], events: []});
    const stale = await sb.runBindings(1, [{id: "b5", self: null}]);
    const ok = fresh && "intents" in fresh[0] && JSON.stringify(fresh[0].intents).includes("Много") && stale === null;
    return ok ? true : JSON.stringify({fresh, stale});
  }},
  {name: "Пакет с зависшей привязкой: срок по пакету, поодиночке остальные отвечают", run: async sb => {
    await sb.load(3, {bindings: [binding("ok1", 'setState("Да")'), binding("hang", "while (true) {}")], events: []});
    sb.setValues(3, VALUES);
    try {
      await sb.runBindings(3, [{id: "ok1", self: null}, {id: "hang", self: null}]);
      return "пакет ответил";
    } catch (err) {
      if (!(err instanceof SandboxTimeoutError) || !err.ids.includes("hang") || !err.ids.includes("ok1")) return String(err);
    }
    const alone = await sb.runBindings(3, [{id: "ok1", self: null}]);
    return alone && "intents" in alone[0] ? true : JSON.stringify(alone);
  }},
  {name: "Значение null у свойства — воркер его забывает", run: async sb => {
    const scope: TagScope = {names: ["P"], tagIdByName: {}, propertyIdByName: {P: 7}, invalidNames: []};
    const b: SandboxBinding = {id: "p1", elementKey: "el", scope, binding: {v: 1, id: "p1", name: "p1", enabled: true, code: "setProp(\"v\", RAW.P)"}};
    await sb.load(4, {bindings: [b], events: []});
    sb.setValues(4, {tags: [], props: [[7, "5"]]});
    const before = await sb.runBindings(4, [{id: "p1", self: null}]);
    sb.setValues(4, {tags: [], props: [[7, null]]});
    const after = await sb.runBindings(4, [{id: "p1", self: null}]);
    const v = (r: typeof before) => (r && "intents" in r[0] ? r[0].intents[0] : null);
    return JSON.stringify(v(before)).includes("5") && JSON.stringify(v(after)).includes("null")
      ? true : JSON.stringify({before, after});
  }},
];

/** Ручная проверка песочницы скриптов: прогоняет CHECKS в настоящем воркере браузера. */
export function SandboxChecks() {
  const [results, setResults] = useState<(string | true | null)[]>(() => CHECKS.map(() => null));

  useEffect(() => {
    const sb = createScriptSandbox();
    let cancelled = false;
    void (async () => {
      for (let i = 0; i < CHECKS.length; i++) {
        let res: string | true;
        try { res = await CHECKS[i].run(sb); } catch (err) { res = String(err); }
        if (cancelled) return;
        setResults(prev => prev.map((r, j) => (j === i ? res : r)));
      }
    })();
    return () => { cancelled = true; sb.dispose(); };
  }, []);

  return (
    <ul className="space-y-2">
      {CHECKS.map((c, i) => {
        const r = results[i];
        return (
          <li key={c.name} data-check={r === true ? "ok" : r === null ? "pending" : "fail"} className="flex items-start gap-3 text-sm">
            <Badge tone={r === true ? "success" : r === null ? "neutral" : "destructive"}>{r === true ? "ok" : r === null ? "…" : "сбой"}</Badge>
            <span className="text-foreground">{c.name}</span>
            {typeof r === "string" && <code className="text-xs text-destructive break-all">{r}</code>}
          </li>
        );
      })}
    </ul>
  );
}
