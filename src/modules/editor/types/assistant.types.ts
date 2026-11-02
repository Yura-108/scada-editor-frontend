/**
 * Запросы и ответы помощника редактора (docs/contract/2026-11-02-assistant-frontend-contract.md).
 * Поля — `snake_case`, как в контракте.
 */

/** Вид скрипта: определяет доступный в нём API, подставляется по месту, где открыт редактор. */
export type AssistantScriptKind = "ON_CLICK" | "BINDING" | "ACTION" | "ON_CHANGE";

/** Предел длины задания и текста описания (контракт). */
export const ASSISTANT_TASK_MAX = 2000;
/** Предел числа скриптов в одном `scripts/edit` и длины кода одного скрипта. */
export const ASSISTANT_EDIT_MAX_SCRIPTS = 200;
export const ASSISTANT_EDIT_MAX_CODE = 20_000;

export interface ScriptGenerateRequest {
  kind: AssistantScriptKind;
  task: string;
}

/** `issues` — замечания статической проверки; непустой — не ошибка, код показываем вместе с ними. */
export interface ScriptGenerateResponse {
  code: string;
  issues: string[];
}

export interface ScriptEditRequest {
  task: string;
  scripts: {id: string; code: string}[];
}

export interface ScriptEditProposal {
  id: string;
  old_code: string;
  new_code: string;
}

/** Скрипта нет ни в `proposals`, ни в `rejected` — модель сочла, что задание к нему не относится. */
export interface ScriptEditResponse {
  proposals: ScriptEditProposal[];
  rejected: {id: string; reason: string}[];
}

export interface TagResolveRequest {
  channel_root: string;
  text: string;
}

export interface TagCandidate {
  path: string;
  /** Может быть пустой строкой. */
  description: string;
}

/**
 * `path` — предложение модели из каталога либо `null`; если не `null`, он первый в `candidates`.
 * Подставлять его самим нельзя: тег выбирает человек.
 */
export interface TagResolveResponse {
  path: string | null;
  candidates: TagCandidate[];
}

export interface ScenePlanRequest {
  channel_root: string;
  task: string;
}

/** Элемент плана. Это НЕ компонент редактора: применять план пока нельзя (`scada-hh7b`). */
export interface ScenePlanElement {
  type: "button" | "text" | "rect" | "circle" | "progress_bar" | "group" | string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Путь из каталога либо пустая строка. */
  tag: string;
}

export interface ScenePlanResponse {
  elements: ScenePlanElement[];
  issues: string[];
}

/** Размер холста, на который модель раскладывает план. */
export const SCENE_PLAN_CANVAS = {width: 1920, height: 1080};
