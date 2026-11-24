import type {ElementEventHandler, TagBinding} from "@/core/scene";
import type {TagScope} from "../script/bindingScope";
import type {BindingIntent} from "../script/executeBinding";
import type {ActionArgs, MenuChoice, PropertyWrite, SceneTarget} from "../script/eventScript";

/**
 * Сообщения между страницей и воркером-песочницей скриптов схем (#20 п. 1, план —
 * `docs/plan-2026-11-04-script-sandbox.md`). Всё здесь — обычные данные: они проходят через
 * структурное клонирование `postMessage`, функций и классов в них нет.
 *
 * `generation` — номер загрузки схемы. Ответ со старым номером хост отбрасывает: поздний результат
 * не должен лечь на уже другую схему или выпуск.
 */

export interface SandboxBinding {
  /** `binding.id` — ключ результата и счётчика ошибок. */
  id: string;
  elementKey: string;
  binding: TagBinding;
  scope: TagScope;
}

export interface SandboxEvent {
  /** Ключ обработчика: `${elementKey}:${eventName}`. */
  id: string;
  elementKey: string;
  handler: ElementEventHandler;
  scope: TagScope;
}

export interface SandboxScripts {
  bindings: SandboxBinding[];
  events: SandboxEvent[];
}

/**
 * Значения скоупа: теги по `tag_id` (null — нет достоверного значения), свойства по
 * `propertyId` (null — значения нет, воркер его забывает: иначе после сброса сессии скрипт
 * прочитал бы прошлое).
 */
export interface SandboxValues {
  tags: [string, string | null][];
  props: [number, string | null][];
}

/** Вызов `runScript(имя, args)` из обработчика: страница отправит ACTION сама, со своими проверками. */
export interface RunScriptCall {
  name: string;
  args?: ActionArgs;
}

/** `stage: "compile"` — код не разобрался (тест-прогон показывает «Ошибка компиляции»), иначе — ошибка исполнения. */
export type RunErrorStage = "compile" | "run";

export type BindingRunResult =
  | {id: string; intents: BindingIntent[]}
  | {id: string; error: string; stage?: RunErrorStage};

export type EventRunResult =
  | {writes: PropertyWrite[]; intents: BindingIntent[]; openScene?: SceneTarget; menu?: MenuChoice[]; runScript: RunScriptCall[]}
  | {error: string; stage?: RunErrorStage};

export type SandboxRequest =
  /** Новая схема: компилирует скрипты, значения сбрасываются. */
  | {type: "load"; generation: number; scripts: SandboxScripts}
  /** Изменения значений — приходят ПОСЛЕ `flush` движка, никогда раньше. */
  | {type: "values"; generation: number; values: SandboxValues}
  | {type: "runBindings"; generation: number; requestId: number; items: {id: string; self: unknown}[]}
  | {type: "runEvent"; generation: number; requestId: number; id: string; self: unknown}
  /** Разовый прогон без загруженной схемы — тест-прогоны редактора. */
  | {type: "testBinding"; requestId: number; binding: SandboxBinding; values: SandboxValues; self: unknown}
  | {type: "testEvent"; requestId: number; event: SandboxEvent; values: SandboxValues; self: unknown};

export type SandboxResponse =
  | {type: "loaded"; generation: number; errors: {id: string; error: string}[]}
  | {type: "bindingsResult"; generation: number; requestId: number; results: BindingRunResult[]}
  | {type: "eventResult"; generation: number; requestId: number; result: EventRunResult}
  | {type: "testBindingResult"; requestId: number; result: BindingRunResult}
  | {type: "testEventResult"; requestId: number; result: EventRunResult};
