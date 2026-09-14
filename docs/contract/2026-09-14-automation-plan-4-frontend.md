# Automation, план 4: фронт — страница «Автоматизация», переменные в привязках, панель «Задачи» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Исполнитель — пользователь.** Файлы `scada-editor-frontend` Claude не правит; план — контракт с точными
> типами, путями и местами правок. Код в шагах — рабочая заготовка, стили можно менять под проект.

**Goal:** Инженер заводит и правит фоновые задачи проекта на странице «Автоматизация», привязывает элементы сцены к переменным проекта `@var.<имя>`, а оператор видит статусы задач в мониторе.

**Architecture:** Фронт ходит в бэкенд только через BFF-роуты `src/app/api/**` (как рецепты и история версий). Страница «Автоматизация» читает и сохраняет набор целиком (`GET/PUT`), история — существующий механизм версий с типом документа `automation`. Статусы задач приходят по уже открытому WebSocket монитора после `SUBSCRIBE_TASKS` и лежат в отдельном zustand-сторе. Переменная проекта для движка привязок — обычный `tag_id`, поэтому `useRuntimeEngine` и `bindingIndex` не меняются.

**Tech Stack:** Next.js 16.1.5, React 19.2, TypeScript, zustand 5, Radix UI, lucide-react, @uiw/react-codemirror + @codemirror/lang-javascript.

**Spec:** `docs/superpowers/specs/2026-09-14-automation-service-design.md` (разделы «API», «Фронт», «Показ в мониторе»)

Четвёртый из четырёх планов. Бэкенд — планы 1–3 (ветки `feat/automation-definitions` → `feat/automation-service` → `feat/automation-runtime`).

## Контракт бэкенда (сверено с кодом 14.09.2026)

| Что | Как |
|---|---|
| Набор проекта | `GET /api/editor/projects/{projectId}/automation` → `AutomationSet` |
| Сохранение | `PUT /api/editor/projects/{projectId}/automation`, тело `AutomationSaveRequest` → `AutomationSet` |
| Ошибки сохранения | 400 `{"error":"automation_invalid","errors":[{task,field,message}]}`; 400 `{message:"based_on_version is required…"}`; 409 `{"error":"version_mismatch","base_version","current_version"}`; 404 — нет проекта |
| Переопубликовать | `POST /api/editor/projects/{projectId}/automation/republish` → 202 |
| История | `GET /api/editor/automation/{projectId}/versions`, `POST /api/editor/automation/{projectId}/restore/{versionNo}` |
| Статусы (REST) | `GET /api/automation/projects/{projectId}/tasks` → `AutomationTaskStatusRow[]` (через gateway) |
| Статусы (WS) | отправить `{"type":"SUBSCRIBE_TASKS"}` / `{"type":"UNSUBSCRIBE_TASKS"}`; кадр `UPDATE` несёт `tasks: AutomationTaskStatus[]` — при подписке полный список, дальше изменения |
| Переменные в кадре | `tags[]` с `tagId = "@var.<имя>"`; запись в них отклоняется статусом `REJECTED_VARIABLE` |

## Global Constraints

- `value_type` задач и переменных — ровно `bool | int | float | string`.
- Переменная проекта в привязке — `property_type: "Тег"`, `tag_id: "@var.<имя>"`.
- Набор сохраняется только целиком; `based_on_version` — `version` из последнего `GET`/`PUT`.
- `period_ms` 100…3 600 000; `timeout_ms` 1…`period_ms/2` (по умолчанию 100); `stale_after_ms` 100…86 400 000; `watchdog.period_ms` 100…60 000 (по умолчанию 1000).
- Статусы задач `state` ∈ `RUNNING | DISABLED | INPUT_STALE | ERROR | OVERRUN`.
- После переподключения WebSocket подписку на статусы нужно отправить заново: новая сессия runtime ничего о ней не знает.
- Фронт ходит в бэкенд только через BFF (`protectedRoute` + `Authorization: Bearer`), `X-Username` проставляет gateway.
- Комментарии — по-русски, коммиты — по-английски, коротко.

## File Structure

```
src/types/automation.types.ts                                   — типы контракта
src/types/editorVersion.types.ts                                — VersionDocType += "automation"
src/lib/editorHistoryProxy.ts                                   — DOC_TYPES += "automation"
src/app/api/editor/automation/[projectId]/route.ts              — BFF GET/PUT набора
src/app/api/editor/automation/[projectId]/republish/route.ts    — BFF POST
src/app/api/automation/projects/[projectId]/tasks/route.ts      — BFF статусов
src/lib/automation/automationApi.ts                             — клиентские вызовы
src/store/useAutomationTasksStore.ts                            — статусы задач
src/lib/runtime/runtimeConnection.ts                            — SUBSCRIBE_TASKS, tasks в кадре
src/lib/runtime/useRuntimeEngine.ts                             — onTasks, subscribe/unsubscribe наружу
src/components/monitor/AutomationTaskPanel.tsx                  — панель «Задачи»
src/app/(app)/monitor/MonitorClient.tsx                         — кнопка и панель
src/app/(app)/automation/page.tsx, AutomationClient.tsx         — страница
src/components/automation/TaskEditor.tsx                        — форма задачи
src/components/automation/IoTable.tsx                           — входы/выходы с выбором тега
src/components/automation/VariablesEditor.tsx                   — переменные и watchdog
src/components/editor/HeaderNav.tsx                             — пункт меню
src/components/ui/OpenChooseTagModal.tsx                        — источник «Переменная проекта»
```

---

### Task 0: Ветка

- [ ] **Step 1**

```powershell
cd Z:\Claude\Projects\scada-editor-frontend
git switch -c feat/automation-ui
```

---

### Task 1: Типы, BFF-роуты, история с типом `automation`

**Files:**
- Create: `src/types/automation.types.ts`
- Create: `src/app/api/editor/automation/[projectId]/route.ts`
- Create: `src/app/api/editor/automation/[projectId]/republish/route.ts`
- Create: `src/app/api/automation/projects/[projectId]/tasks/route.ts`
- Modify: `src/types/editorVersion.types.ts`, `src/lib/editorHistoryProxy.ts`

**Interfaces:**
- Produces: типы `AutomationValueType`, `AutomationIo`, `AutomationTask`, `AutomationVariable`, `AutomationWatchdog`, `AutomationSet`, `AutomationSaveRequest`, `AutomationValidationError`, `AutomationTaskState`, `AutomationTaskStatus`, `AutomationTaskStatusRow`, константа `VARIABLE_TAG_PREFIX`; BFF `GET/PUT /api/editor/automation/{projectId}`, `POST /api/editor/automation/{projectId}/republish`, `GET /api/automation/projects/{projectId}/tasks`; история `/api/editor/history/automation/{projectId}/…`.

- [ ] **Step 1: Типы**

`src/types/automation.types.ts`:

```ts
/** Контракт сервиса automation и набора задач в editor (сверено с бэкендом 14.09.2026). */

export type AutomationValueType = "bool" | "int" | "float" | "string";

export const AUTOMATION_VALUE_TYPES: AutomationValueType[] = ["bool", "int", "float", "string"];

/** Префикс адреса переменной проекта в tag_id привязки. */
export const VARIABLE_TAG_PREFIX = "@var.";

export interface AutomationIo {
  alias: string;
  tag: string;
  value_type: AutomationValueType;
}

export interface AutomationTask {
  /** Есть у сохранённой задачи; без него задача создаётся. id — ключ памяти задачи в automation. */
  id?: number | null;
  name: string;
  enabled: boolean;
  period_ms: number;
  timeout_ms?: number | null;
  stale_after_ms: number;
  run_on_stale: boolean;
  inputs: AutomationIo[];
  outputs: AutomationIo[];
  writes_variables: string[];
  script: string;
}

export interface AutomationVariable {
  name: string;
  value_type: AutomationValueType;
  default_value: string | null;
  description: string | null;
}

export interface AutomationWatchdog {
  tag: string;
  period_ms: number;
}

export interface AutomationSet {
  project_id: number;
  /** null — набор ни разу не сохраняли. */
  version: number | null;
  tasks: AutomationTask[];
  variables: AutomationVariable[];
  watchdog: AutomationWatchdog | null;
}

export interface AutomationSaveRequest {
  based_on_version: number | null;
  tasks: AutomationTask[];
  variables: AutomationVariable[];
  watchdog: AutomationWatchdog | null;
}

export interface AutomationValidationError {
  /** null — нарушение уровня проекта (переменные, watchdog). */
  task: string | null;
  field: string;
  message: string;
}

export type AutomationTaskState = "RUNNING" | "DISABLED" | "INPUT_STALE" | "ERROR" | "OVERRUN";

/** Элемент кадра WS `UPDATE.tasks[]`. */
export interface AutomationTaskStatus {
  taskId: number;
  name: string;
  state: AutomationTaskState;
  lastRunAt: number | null;
  lastDurationMs: number | null;
  lastError: string | null;
  errorCount: number;
  owner: string | null;
}

/** Строка `GET /api/automation/projects/{projectId}/tasks`. */
export interface AutomationTaskStatusRow {
  projectId: number;
  taskId: number;
  name: string;
  state: AutomationTaskState;
  lastRunAtMs: number | null;
  lastDurationMs: number | null;
  lastError: string | null;
  errorCount: number;
  ownerInstance: string | null;
}
```

- [ ] **Step 2: BFF набора**

`src/app/api/editor/automation/[projectId]/route.ts`:

```ts
import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId} from "@/lib/editorHistoryProxy";

/**
 * Ответ бэкенда отдаётся как есть: 400 automation_invalid и 409 version_mismatch несут тело,
 * которое страница разбирает (список нарушений, номера версий).
 */
const passThrough = async (response: Response) => {
  const text = await response.text().catch(() => "");
  return new NextResponse(text || null, {
    status: response.status,
    headers: {"Content-Type": response.headers.get("content-type") ?? "application/json"},
  });
};

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/automation`, {
    method: "GET",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
  });
  return passThrough(response);
});

export const PUT = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({message: "Пустое тело запроса"}, {status: 400});
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/automation`, {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  return passThrough(response);
});
```

`src/app/api/editor/automation/[projectId]/republish/route.ts`:

```ts
import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, EDITOR_BACKEND_URL, parseId} from "@/lib/editorHistoryProxy";

export const POST = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/automation/republish`, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`},
  });
  const text = await response.text().catch(() => "");
  return new NextResponse(text || null, {status: response.status});
});
```

- [ ] **Step 3: BFF статусов**

`src/app/api/automation/projects/[projectId]/tasks/route.ts`:

```ts
import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {badPath, parseId} from "@/lib/editorHistoryProxy";

/** automation доступен через gateway (/api/automation/**). */
const AUTOMATION_BACKEND_URL =
  process.env.BACKEND_URL_AUTOMATION || process.env.BACKEND_URL || "http://localhost:8080";

export const GET = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const response = await fetch(`${AUTOMATION_BACKEND_URL}/api/automation/projects/${projectId}/tasks`, {
    method: "GET",
    headers: {Authorization: `Bearer ${token}`},
  });
  const data = await response.json().catch(() => null);
  return NextResponse.json(Array.isArray(data) ? data : [], {status: response.ok ? 200 : response.status});
});
```

- [ ] **Step 4: История принимает `automation`**

`src/types/editorVersion.types.ts` — строку

```ts
export type VersionDocType = "scenes" | "templates";
```

заменить на

```ts
export type VersionDocType = "scenes" | "templates" | "automation";
```

`src/lib/editorHistoryProxy.ts` — в объявлении `DOC_TYPES` (массив, который читает `parseDocType`) добавить `"automation"` третьим элементом. В роутах `src/app/api/editor/history/[docType]/**` текст ошибки «ожидается scenes или templates» заменить на «ожидается scenes, templates или automation».

- [ ] **Step 5: Проверка**

Run: `npx tsc --noEmit`
Expected: без ошибок. Руками: при запущенном стенде `GET http://localhost:3000/api/editor/automation/8501` (из браузера под логином) отдаёт JSON набора.

- [ ] **Step 6: Commit**

```powershell
git add src/types src/lib/editorHistoryProxy.ts src/app/api/editor/automation src/app/api/automation src/app/api/editor/history
git commit -m "Add automation API types and BFF routes"
```

---

### Task 2: Клиентский API и стор статусов

**Files:**
- Create: `src/lib/automation/automationApi.ts`
- Create: `src/store/useAutomationTasksStore.ts`

**Interfaces:**
- Consumes: типы Task 1; `fetchVersions` из `src/lib/editor/versionsApi.ts`.
- Produces:
  - `fetchAutomation(projectId): Promise<AutomationSet>`
  - `saveAutomation(projectId, body: AutomationSaveRequest): Promise<AutomationSet>` — бросает `AutomationSaveError` (`errors`, `conflict`)
  - `republishAutomation(projectId): Promise<void>`
  - `fetchAutomationVersions(projectId): Promise<VersionSummary[]>`, `restoreAutomationVersion(projectId, versionNo): Promise<void>`
  - `fetchTaskStatuses(projectId): Promise<AutomationTaskStatusRow[]>`
  - `useAutomationTasksStore` (`byId: Record<number, AutomationTaskStatus>`), `pushTaskStatuses(tasks)`, `resetTaskStatuses()`

- [ ] **Step 1: API**

`src/lib/automation/automationApi.ts`:

```ts
import type {
  AutomationSaveRequest,
  AutomationSet,
  AutomationTaskStatusRow,
  AutomationValidationError,
} from "@/types/automation.types";
import type {VersionSummary} from "@/types/editorVersion.types";
import {fetchVersions} from "@/lib/editor/versionsApi";

/** Ошибка сохранения набора: список нарушений проверки или конфликт версий. */
export class AutomationSaveError extends Error {
  constructor(
    message: string,
    readonly errors: AutomationValidationError[] = [],
    readonly conflict = false,
  ) {
    super(message);
  }
}

const readJson = async (res: Response) => res.json().catch(() => null);

export const fetchAutomation = async (projectId: number): Promise<AutomationSet> => {
  const res = await fetch(`/api/editor/automation/${projectId}`);
  if (!res.ok) throw new Error(`Не удалось загрузить автоматизацию проекта (${res.status})`);
  return res.json();
};

export const saveAutomation = async (projectId: number, body: AutomationSaveRequest): Promise<AutomationSet> => {
  const res = await fetch(`/api/editor/automation/${projectId}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (res.ok) return data as AutomationSet;
  if (res.status === 400 && data?.error === "automation_invalid") {
    throw new AutomationSaveError("Набор не прошёл проверку", data.errors ?? []);
  }
  if (res.status === 409) {
    throw new AutomationSaveError("Набор уже изменил кто-то другой — перезагрузите его", [], true);
  }
  throw new AutomationSaveError(data?.message ?? `Не удалось сохранить набор (${res.status})`);
};

export const republishAutomation = async (projectId: number): Promise<void> => {
  const res = await fetch(`/api/editor/automation/${projectId}/republish`, {method: "POST"});
  if (!res.ok) throw new Error(`Не удалось переопубликовать набор (${res.status})`);
};

export const fetchAutomationVersions = (projectId: number): Promise<VersionSummary[]> =>
  fetchVersions("automation", projectId);

/** Откат: бэкенд записывает содержимое версии новой версией и публикует его в automation. */
export const restoreAutomationVersion = async (projectId: number, versionNo: number): Promise<void> => {
  const res = await fetch(`/api/editor/history/automation/${projectId}/restore/${versionNo}`, {method: "POST"});
  if (!res.ok) {
    const data = await readJson(res);
    throw new Error(data?.message ?? `Не удалось восстановить версию (${res.status})`);
  }
};

export const fetchTaskStatuses = async (projectId: number): Promise<AutomationTaskStatusRow[]> => {
  const res = await fetch(`/api/automation/projects/${projectId}/tasks`);
  if (!res.ok) return [];
  const data = await readJson(res);
  return Array.isArray(data) ? data : [];
};
```

- [ ] **Step 2: Стор**

`src/store/useAutomationTasksStore.ts`:

```ts
import {create} from "zustand";
import type {AutomationTaskStatus} from "@/types/automation.types";

interface AutomationTasksState {
  /** Статусы задач текущего проекта монитора по taskId. */
  byId: Record<number, AutomationTaskStatus>;
}

export const useAutomationTasksStore = create<AutomationTasksState>(() => ({byId: {}}));

/** Кадр WS несёт и полный список (при подписке), и отдельные изменения — merge по taskId. */
export const pushTaskStatuses = (tasks: AutomationTaskStatus[]): void => {
  if (!tasks.length) return;
  useAutomationTasksStore.setState(state => {
    const byId = {...state.byId};
    for (const task of tasks) byId[task.taskId] = task;
    return {byId};
  });
};

export const resetTaskStatuses = (): void => {
  useAutomationTasksStore.setState({byId: {}});
};
```

- [ ] **Step 3: Проверка и commit**

Run: `npx tsc --noEmit` — без ошибок.

```powershell
git add src/lib/automation src/store/useAutomationTasksStore.ts
git commit -m "Add automation client API and task status store"
```

---

### Task 3: Статусы задач по WebSocket монитора

**Files:**
- Modify: `src/lib/runtime/runtimeConnection.ts`
- Modify: `src/lib/runtime/useRuntimeEngine.ts`

**Interfaces:**
- Consumes: `AutomationTaskStatus` (Task 1), `pushTaskStatuses`, `resetTaskStatuses` (Task 2).
- Produces: `RuntimeConnectionHandlers.onTasks?: (tasks: AutomationTaskStatus[]) => void`; `RuntimeConnection.subscribeTasks(): void`, `unsubscribeTasks(): void`; `useRuntimeEngine(...)` возвращает дополнительно `subscribeTasks`, `unsubscribeTasks`.

- [ ] **Step 1: Соединение**

В `src/lib/runtime/runtimeConnection.ts`:

1) После `import type {ProcedureEvent} from "@/types/recipe.types";` добавить:

```ts
import type {AutomationTaskStatus} from "@/types/automation.types";
```

2) В `interface RuntimeConnectionHandlers` после `onStatus?: …;` добавить:

```ts
  /** Статусы задач automation — приходят только после subscribeTasks(). */
  onTasks?: (tasks: AutomationTaskStatus[]) => void;
```

3) В `interface RuntimeConnection` после `sendAction: (scriptId: number) => void;` добавить:

```ts
  subscribeTasks: () => void;
  unsubscribeTasks: () => void;
```

4) Сигнатуру `{onUpdate, onStatus}: RuntimeConnectionHandlers` заменить на `{onUpdate, onStatus, onTasks}: RuntimeConnectionHandlers`, а после строки `let currentSessionId: string | null = null;` добавить:

```ts
  // Подписка живёт на соединении, а не на сессии runtime: после переподключения новая сессия
  // о ней не знает, поэтому onopen отправляет SUBSCRIBE_TASKS заново.
  let tasksWanted = false;
```

5) В `socket.onopen` после блока `pingTimer = setInterval(…);` добавить:

```ts
      if (tasksWanted) socket.send(JSON.stringify({type: "SUBSCRIBE_TASKS"}));
```

6) В `socket.onmessage` в объявлении типа `msg` после `procedures?: ProcedureEvent[] | null;` добавить `tasks?: AutomationTaskStatus[] | null;`, а после вызова `onUpdate(tags, properties, procedures);` добавить:

```ts
      if (msg.tasks?.length) onTasks?.(msg.tasks);
```

7) В возвращаемом объекте после метода `sendAction` добавить:

```ts
    subscribeTasks: () => {
      tasksWanted = true;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: "SUBSCRIBE_TASKS"}));
    },
    unsubscribeTasks: () => {
      tasksWanted = false;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: "UNSUBSCRIBE_TASKS"}));
    },
```

- [ ] **Step 2: Движок монитора**

В `src/lib/runtime/useRuntimeEngine.ts`:

1) После `import {pushProcedureEvents} from "@/store/useProcedureStore";` добавить:

```ts
import {pushTaskStatuses, resetTaskStatuses} from "@/store/useAutomationTasksStore";
```

(`useCallback` уже импортирован из `"react"` в строке 4).

2) В эффекте соединения после `lastMessageAtRef.current = 0;` добавить `resetTaskStatuses();`, а в вызове `openRuntimeConnection(projectId, {` перед `onUpdate: (tags, properties, procedures) => {` добавить строку:

```ts
      onTasks: pushTaskStatuses,
```

3) Перед `return {` в конце хука добавить:

```ts
  const subscribeTasks = useCallback(() => connRef.current?.subscribeTasks(), []);
  const unsubscribeTasks = useCallback(() => connRef.current?.unsubscribeTasks(), []);
```

и в возвращаемый объект после `isStale,` добавить `subscribeTasks, unsubscribeTasks,`.

- [ ] **Step 3: Проверка**

Run: `npx tsc --noEmit` — без ошибок. Руками: открыть монитор, в консоли `[monitor:ws]` нет ошибок, теги обновляются как раньше.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/runtime
git commit -m "Subscribe monitor connection to automation task statuses"
```

---

### Task 4: Панель «Задачи» в мониторе

**Files:**
- Create: `src/components/monitor/AutomationTaskPanel.tsx`
- Modify: `src/app/(app)/monitor/MonitorClient.tsx`

**Interfaces:**
- Consumes: `useAutomationTasksStore` (Task 2); `subscribeTasks` из `useRuntimeEngine` (Task 3).
- Produces: `AutomationTaskPanel({onClose})`, `countTaskProblems(byId): number`, `TASK_STATE_VIEW`.

- [ ] **Step 1: Панель**

`src/components/monitor/AutomationTaskPanel.tsx`:

```tsx
"use client";

import React, {useEffect, useMemo, useState} from "react";
import {X} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAutomationTasksStore} from "@/store/useAutomationTasksStore";
import type {AutomationTaskState, AutomationTaskStatus} from "@/types/automation.types";

export const TASK_STATE_VIEW: Record<AutomationTaskState, {label: string; className: string}> = {
  RUNNING: {label: "Работает", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"},
  DISABLED: {label: "Выключена", className: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400"},
  INPUT_STALE: {label: "Нет свежих входов", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  OVERRUN: {label: "Не укладывается в период", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  ERROR: {label: "Ошибка", className: "bg-red-500/15 text-red-600 dark:text-red-400"},
};

const PROBLEM_STATES = new Set<AutomationTaskState>(["ERROR", "INPUT_STALE", "OVERRUN"]);

/** Сколько задач требуют внимания — для бейджа на кнопке. */
export const countTaskProblems = (byId: Record<number, AutomationTaskStatus>): number =>
  Object.values(byId).filter(t => PROBLEM_STATES.has(t.state)).length;

const formatAge = (lastRunAt: number | null, now: number): string => {
  if (lastRunAt == null) return "не запускалась";
  const seconds = Math.max(0, Math.round((now - lastRunAt) / 1000));
  return seconds < 60 ? `${seconds} с назад` : `${Math.round(seconds / 60)} мин назад`;
};

/**
 * Статусы фоновых задач проекта. Задачи крутятся в сервисе automation независимо от того,
 * открыт ли монитор, — панель только показывает то, что пришло кадром UPDATE.tasks.
 */
export function AutomationTaskPanel({onClose}: {onClose: () => void}) {
  const byId = useAutomationTasksStore(s => s.byId);
  const tasks = useMemo(
    () => Object.values(byId).sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [byId],
  );

  // «N с назад» должно идти само, даже если статус задачи не меняется.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className="absolute right-3 top-3 bottom-3 z-20 w-[380px] max-w-[calc(100%-1.5rem)] flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <span className="text-sm font-semibold">Фоновые задачи</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            У проекта нет задач, или сервис automation ещё не прислал статусы.
          </p>
        )}
        {tasks.map(task => {
          const view = TASK_STATE_VIEW[task.state] ?? TASK_STATE_VIEW.ERROR;
          return (
            <div key={task.taskId} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-medium" title={task.name}>{task.name}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", view.className)}>{view.label}</span>
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatAge(task.lastRunAt, now)}
                {task.lastDurationMs != null && ` · ${task.lastDurationMs} мс`}
                {task.errorCount > 0 && ` · ошибок подряд: ${task.errorCount}`}
              </div>
              {task.lastError && (
                <div className="text-xs text-red-600 dark:text-red-400 break-words">{task.lastError}</div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Кнопка и подписка в мониторе**

В `src/app/(app)/monitor/MonitorClient.tsx`:

1) В импорт `lucide-react` добавить `Cpu`; после импорта `ProcedureHud` добавить:

```tsx
import {AutomationTaskPanel, countTaskProblems} from "@/components/monitor/AutomationTaskPanel";
import {useAutomationTasksStore} from "@/store/useAutomationTasksStore";
```

2) Строку `const {status, compileErrors, runtimeErrors, sessionId, rejectionReason, isStale} = useRuntimeEngine(...)` заменить на:

```tsx
  const {status, compileErrors, runtimeErrors, sessionId, rejectionReason, isStale, subscribeTasks} =
    useRuntimeEngine(Boolean(scene && currentProject));

  // Подписка на статусы — пока монитор открыт. sessionId меняется при каждом переподключении
  // и смене проекта: повторная подписка безвредна, сервер просто пришлёт полный список ещё раз.
  useEffect(() => {
    if (sessionId) subscribeTasks();
  }, [sessionId, subscribeTasks]);

  const [showTasks, setShowTasks] = useState(false);
  const taskProblems = useAutomationTasksStore(s => countTaskProblems(s.byId));
```

3) Перед блоком `{problemCount > 0 && (` добавить кнопку:

```tsx
        {status === "live" && sessionId && (
          <button
            onClick={() => setShowTasks(v => !v)}
            aria-pressed={showTasks}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
              taskProblems > 0
                ? "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25"
                : "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25",
            )}
            title={taskProblems > 0 ? `Задач с проблемами: ${taskProblems}` : "Фоновые задачи проекта"}
          >
            <Cpu size={14} />
            Задачи{taskProblems > 0 ? `: ${taskProblems}` : ""}
          </button>
        )}
```

4) После строки `{!showProcedures && <ProcedureHud />}` добавить:

```tsx
        {showTasks && <AutomationTaskPanel onClose={() => setShowTasks(false)} />}
```

- [ ] **Step 3: Проверка**

Run: `npx tsc --noEmit` — без ошибок.
Руками (стенд с набором `apply-bn1-mca1-pump-pid.ps1`): монитор → проект 8501 → любая схема → «Задачи». Видны задачи набора со статусом «Работает», «N с назад» тикает. В DevTools → Network → WS: исходящий `{"type":"SUBSCRIBE_TASKS"}`, входящий `UPDATE` с `tasks`.

- [ ] **Step 4: Commit**

```powershell
git add src/components/monitor/AutomationTaskPanel.tsx "src/app/(app)/monitor/MonitorClient.tsx"
git commit -m "Show automation task statuses in monitor"
```

---

### Task 5: Страница «Автоматизация»: загрузка, сохранение, история

**Files:**
- Modify: `src/components/editor/HeaderNav.tsx`
- Create: `src/app/(app)/automation/page.tsx`
- Create: `src/app/(app)/automation/AutomationClient.tsx`

**Interfaces:**
- Consumes: API Task 2; `TASK_STATE_VIEW` (Task 4); `confirmModal` из `@/components/ui/ConfirmModal`; `useEditorStore` (`projectList`, `currentProject`, `loadProjectList`, `setCurrentProject`).
- Produces: маршрут `/automation`; `AutomationClient` держит черновик `draft: AutomationSet`, отдаёт в Task 6 пропсы `TaskEditor({task, variables, errors, onChange, onDelete})` и `VariablesEditor({variables, watchdog, errors, onVariablesChange, onWatchdogChange})`.

- [ ] **Step 1: Пункт меню**

`src/components/editor/HeaderNav.tsx`: в импорт `lucide-react` добавить `Cpu`, в `navItems` после «Монитор» вставить:

```ts
  {
    name: "Автоматизация",
    href: "/automation",
    icon: Cpu,
  },
```

- [ ] **Step 2: Страница**

`src/app/(app)/automation/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

const Automation = dynamic(() => import("./AutomationClient"), {ssr: false});

export default function Page() {
  return <Automation />;
}
```

`src/app/(app)/automation/AutomationClient.tsx`:

```tsx
"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {History, Plus, RefreshCw, Save, Send} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useEditorStore} from "@/store/useEditorStore";
import {
  AutomationSaveError,
  fetchAutomation,
  fetchAutomationVersions,
  fetchTaskStatuses,
  republishAutomation,
  restoreAutomationVersion,
  saveAutomation,
} from "@/lib/automation/automationApi";
import {TASK_STATE_VIEW} from "@/components/monitor/AutomationTaskPanel";
import {TaskEditor} from "@/components/automation/TaskEditor";
import {VariablesEditor} from "@/components/automation/VariablesEditor";
import type {
  AutomationSet,
  AutomationTask,
  AutomationTaskStatusRow,
  AutomationValidationError,
} from "@/types/automation.types";
import type {VersionSummary} from "@/types/editorVersion.types";

type Tab = "tasks" | "variables" | "history";

const newTask = (index: number): AutomationTask => ({
  id: null,
  name: `Задача ${index}`,
  // Новая задача выключена: включают осознанно, когда входы и выходы проверены.
  enabled: false,
  period_ms: 1000,
  timeout_ms: 100,
  stale_after_ms: 5000,
  run_on_stale: false,
  inputs: [],
  outputs: [],
  writes_variables: [],
  script: "// inputs.<alias> — значения входов, write('<alias>', value) — запись выхода\n"
    + "// state — память между тактами, dt — мс с прошлого успешного такта, firstRun\n",
});

/**
 * Редактор фоновых задач проекта. Сохраняется набор целиком: задачи, переменные, watchdog.
 * Исполняет задачи сервис automation — страница нужна только для правки определений.
 */
export default function AutomationClient() {
  const projectList = useEditorStore(s => s.projectList);
  const currentProject = useEditorStore(s => s.currentProject);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);

  const [draft, setDraft] = useState<AutomationSet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<AutomationValidationError[]>([]);
  const [tab, setTab] = useState<Tab>("tasks");
  const [selected, setSelected] = useState(0);
  const [statuses, setStatuses] = useState<AutomationTaskStatusRow[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);

  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  const projectId = currentProject?.id ?? null;

  const reload = useCallback(async () => {
    if (projectId == null) return;
    try {
      const [set, rows] = await Promise.all([fetchAutomation(projectId), fetchTaskStatuses(projectId)]);
      setDraft(set);
      setStatuses(rows);
      setDirty(false);
      setErrors([]);
      setSelected(0);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (tab !== "history" || projectId == null) return;
    fetchAutomationVersions(projectId).then(setVersions).catch(err => toast.error((err as Error).message));
  }, [tab, projectId, draft?.version]);

  const update = (patch: Partial<AutomationSet>) => {
    setDraft(d => (d ? {...d, ...patch} : d));
    setDirty(true);
  };

  const updateTask = (index: number, task: AutomationTask) =>
    update({tasks: draft!.tasks.map((t, i) => (i === index ? task : t))});

  const handleSave = async () => {
    if (!draft || projectId == null) return;
    setSaving(true);
    try {
      const saved = await saveAutomation(projectId, {
        based_on_version: draft.version,
        tasks: draft.tasks,
        variables: draft.variables,
        watchdog: draft.watchdog,
      });
      setDraft(saved);
      setDirty(false);
      setErrors([]);
      toast.success(`Сохранено, версия ${saved.version}`);
    } catch (err) {
      if (err instanceof AutomationSaveError && err.errors.length) {
        setErrors(err.errors);
        toast.error(`Набор не прошёл проверку: ${err.errors.length}`);
      } else {
        toast.error((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRepublish = async () => {
    if (projectId == null) return;
    try {
      await republishAutomation(projectId);
      toast.success("Набор отправлен в automation заново");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRestore = async (versionNo: number) => {
    if (projectId == null) return;
    const ok = await confirmModal({
      title: `Восстановить версию ${versionNo}?`,
      description: "Набор задач заменится содержимым этой версии и сразу уйдёт в automation. "
        + "История не теряется: восстановление запишется новой версией.",
      confirmLabel: "Восстановить",
      danger: true,
    });
    if (!ok) return;
    try {
      await restoreAutomationVersion(projectId, versionNo);
      await reload();
      toast.success(`Версия ${versionNo} восстановлена`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const taskErrors = (name: string) => errors.filter(e => e.task === name);
  // watchdog.tag, занятый выходом задачи, приходит с именем этой задачи — показываем его и на вкладке watchdog.
  const projectErrors = useMemo(
    () => errors.filter(e => e.task === null || e.field.startsWith("watchdog")),
    [errors],
  );
  const statusOf = (task: AutomationTask) => statuses.find(s => s.taskId === task.id);
  const task = draft?.tasks[selected];

  return (
    <div className="fixed inset-0 top-(--app-header-h) overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80">
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Автоматизация</span>
        <select
          className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-sm"
          value={projectId ?? ""}
          onChange={e => setCurrentProject(projectList.find(p => p.id === Number(e.target.value)) ?? null)}
        >
          <option value="" disabled>Проект…</option>
          {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(["tasks", "variables", "history"] as Tab[]).map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn("px-3 py-1 rounded-lg text-sm", tab === key ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
          >
            {key === "tasks" ? "Задачи" : key === "variables" ? "Переменные и watchdog" : "История"}
          </button>
        ))}
        <div className="flex-1" />
        {draft && <span className="text-xs text-neutral-500">версия {draft.version ?? "—"}{dirty ? " · есть несохранённые правки" : ""}</span>}
        <Button onClick={() => void reload()} disabled={!draft} title="Перечитать с сервера"><RefreshCw size={14} /></Button>
        <Button onClick={handleRepublish} disabled={!draft || dirty} title="Отправить сохранённый набор в automation заново"><Send size={14} /></Button>
        <Button variant="primary" onClick={handleSave} disabled={!draft || !dirty || saving}>
          <Save size={14} />{saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>

      {projectErrors.length > 0 && (
        <div className="shrink-0 px-4 py-2 text-sm bg-red-500/10 text-red-700 dark:text-red-300 space-y-0.5">
          {projectErrors.map((e, i) => <div key={i}>{e.field}: {e.message}</div>)}
        </div>
      )}

      {!draft ? (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">Выберите проект</div>
      ) : tab === "tasks" ? (
        <div className="flex-1 min-h-0 flex">
          <div className="w-64 shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto p-2 space-y-1">
            {draft.tasks.map((t, i) => {
              const status = statusOf(t);
              return (
                <button
                  key={t.id ?? `new-${i}`}
                  onClick={() => setSelected(i)}
                  className={cn("w-full text-left px-3 py-2 rounded-lg text-sm", i === selected ? "bg-indigo-500/15" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
                >
                  <div className={cn("truncate", taskErrors(t.name).length > 0 && "text-red-600 dark:text-red-400")}>{t.name}</div>
                  {status && !dirty && <div className={cn("mt-1 inline-block px-1.5 rounded text-[11px]", TASK_STATE_VIEW[status.state]?.className)}>{TASK_STATE_VIEW[status.state]?.label ?? status.state}</div>}
                </button>
              );
            })}
            <Button className="w-full" onClick={() => { update({tasks: [...draft.tasks, newTask(draft.tasks.length + 1)]}); setSelected(draft.tasks.length); }}>
              <Plus size={14} />Задача
            </Button>
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto">
            {task ? (
              <TaskEditor
                task={task}
                variables={draft.variables}
                errors={taskErrors(task.name)}
                onChange={t => updateTask(selected, t)}
                onDelete={() => { update({tasks: draft.tasks.filter((_, i) => i !== selected)}); setSelected(0); }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-neutral-500">Задач нет</div>
            )}
          </div>
        </div>
      ) : tab === "variables" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <VariablesEditor
            variables={draft.variables}
            watchdog={draft.watchdog}
            errors={projectErrors}
            onVariablesChange={variables => update({variables})}
            onWatchdogChange={watchdog => update({watchdog})}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 max-w-2xl">
          {versions.length === 0 && <p className="text-sm text-neutral-500">Сохранений ещё не было.</p>}
          {versions.map(v => (
            <div key={v.version_no} className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm">
              <History size={14} className="text-neutral-400" />
              <span className="font-medium">v{v.version_no}</span>
              <span className="text-neutral-500">{v.kind}{v.restored_from ? ` из v${v.restored_from}` : ""}</span>
              <span className="text-neutral-500">{v.user_name}</span>
              <span className="flex-1 text-neutral-500">{new Date(v.created_at).toLocaleString("ru")}</span>
              {v.version_no !== draft.version && (
                <Button onClick={() => void handleRestore(v.version_no)} disabled={dirty} title={dirty ? "Сначала сохраните или перечитайте набор" : undefined}>
                  Восстановить
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Пояснения к решениям:
- «Переопубликовать» и «Восстановить» недоступны при несохранённых правках: иначе пользователь думает, что отправил черновик, а уходит сохранённая версия.
- Статус в списке прячется при `dirty`: после правки сопоставление по `taskId` уже может врать (задачу переименовали или удалили).
- 409 показывается тостом «перезагрузите»: в редакторе набора слияния нет, кнопка «перечитать» рядом.

- [ ] **Step 3: Проверка**

Компоненты `TaskEditor` и `VariablesEditor` появятся в Task 6 — до неё `tsc` на них ругается, поэтому проверка и commit — после Task 6.

---

### Task 6: Форма задачи, входы/выходы, переменные и watchdog

**Files:**
- Create: `src/components/automation/IoTable.tsx`
- Create: `src/components/automation/TaskEditor.tsx`
- Create: `src/components/automation/VariablesEditor.tsx`

**Interfaces:**
- Consumes: типы Task 1; `DeviceTreePanel` (`@/components/channels/DeviceTreePanel`), `useDeviceStore(s => s.selectedDevice)` — путь выбранного тега; CodeMirror + `javascript()`.
- Produces: `IoTable({title, rows, variables, onChange})`, `TaskEditor({task, variables, errors, onChange, onDelete})`, `VariablesEditor({variables, watchdog, errors, onVariablesChange, onWatchdogChange})`.

- [ ] **Step 1: Таблица входов/выходов**

`src/components/automation/IoTable.tsx`:

```tsx
"use client";

import React from "react";
import {ArrowLeftToLine, Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/Button";
import {useDeviceStore} from "@/store/useDeviceStore";
import {
  AUTOMATION_VALUE_TYPES,
  VARIABLE_TAG_PREFIX,
  type AutomationIo,
  type AutomationValueType,
  type AutomationVariable,
} from "@/types/automation.types";

const cellInput = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

interface Props {
  title: string;
  rows: AutomationIo[];
  /** Для подсказки `@var.<имя>` в поле тега — входом задачи может быть переменная проекта. */
  variables: AutomationVariable[];
  onChange: (rows: AutomationIo[]) => void;
}

/** Входы или выходы задачи: alias для скрипта, путь тега, тип значения. */
export function IoTable({title, rows, variables, onChange}: Props) {
  const selectedDevice = useDeviceStore(s => s.selectedDevice);
  const listId = `${title}-vars`;

  const patch = (index: number, value: Partial<AutomationIo>) =>
    onChange(rows.map((row, i) => (i === index ? {...row, ...value} : row)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">{title}</span>
        <Button onClick={() => onChange([...rows, {alias: "", tag: "", value_type: "float"}])}>
          <Plus size={14} />Добавить
        </Button>
      </div>
      <datalist id={listId}>
        {variables.map(v => <option key={v.name} value={`${VARIABLE_TAG_PREFIX}${v.name}`} />)}
      </datalist>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr_auto_100px_auto] gap-2 items-center">
          <input className={cellInput} placeholder="alias" value={row.alias} onChange={e => patch(i, {alias: e.target.value})} />
          <input className={cellInput} placeholder="путь тега или @var.имя" list={listId} value={row.tag} onChange={e => patch(i, {tag: e.target.value})} title={row.tag} />
          <Button
            onClick={() => selectedDevice && patch(i, {tag: selectedDevice})}
            disabled={!selectedDevice}
            title={selectedDevice ? `Подставить ${selectedDevice}` : "Выберите тег в дереве справа"}
          >
            <ArrowLeftToLine size={14} />
          </Button>
          <select className={cellInput} value={row.value_type} onChange={e => patch(i, {value_type: e.target.value as AutomationValueType})}>
            {AUTOMATION_VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button onClick={() => onChange(rows.filter((_, j) => j !== i))} title="Удалить"><Trash2 size={14} /></Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Форма задачи**

`src/components/automation/TaskEditor.tsx`:

```tsx
"use client";

import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {Trash2} from "lucide-react";
import {Button} from "@/components/ui/Button";
import DeviceTreePanel from "@/components/channels/DeviceTreePanel";
import {IoTable} from "@/components/automation/IoTable";
import type {AutomationTask, AutomationValidationError, AutomationVariable} from "@/types/automation.types";

const input = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm";
const label = "block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1";

interface Props {
  task: AutomationTask;
  variables: AutomationVariable[];
  errors: AutomationValidationError[];
  onChange: (task: AutomationTask) => void;
  onDelete: () => void;
}

const toInt = (raw: string): number => (raw === "" ? 0 : Math.trunc(Number(raw)));

export function TaskEditor({task, variables, errors, onChange, onDelete}: Props) {
  const set = (patch: Partial<AutomationTask>) => onChange({...task, ...patch});
  const errorOf = (field: string) => errors.filter(e => e.field === field).map(e => e.message).join("; ");

  const numberField = (field: "period_ms" | "timeout_ms" | "stale_after_ms", title: string, hint: string) => (
    <div>
      <label className={label}>{title}</label>
      <input type="number" className={input} value={task[field] ?? ""} onChange={e => set({[field]: toInt(e.target.value)})} />
      <p className={errorOf(field) ? "text-xs text-red-600 mt-1" : "text-xs text-neutral-500 mt-1"}>{errorOf(field) || hint}</p>
    </div>
  );

  const toggleWrite = (name: string, on: boolean) =>
    set({writes_variables: on ? [...task.writes_variables, name] : task.writes_variables.filter(v => v !== name)});

  return (
    <div className="flex gap-4 p-4">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={label}>Название</label>
            <input className={input} value={task.name} onChange={e => set({name: e.target.value})} />
            {errorOf("name") && <p className="text-xs text-red-600 mt-1">{errorOf("name")}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={task.enabled} onChange={e => set({enabled: e.target.checked})} />Включена
          </label>
          <label className="flex items-center gap-2 text-sm pb-2" title="Выполнять такт, даже если входы устарели (скрипт сам проверяет input(alias).stale)">
            <input type="checkbox" checked={task.run_on_stale} onChange={e => set({run_on_stale: e.target.checked})} />Работать на устаревших входах
          </label>
          <Button variant="danger" onClick={onDelete}><Trash2 size={14} />Удалить</Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {numberField("period_ms", "Период, мс", "100 … 3 600 000")}
          {numberField("timeout_ms", "Таймаут скрипта, мс", `1 … ${Math.max(1, Math.floor(task.period_ms / 2))}`)}
          {numberField("stale_after_ms", "Вход устарел через, мс", "100 … 86 400 000")}
        </div>

        {errorOf("inputs") && <p className="text-xs text-red-600">{errorOf("inputs")}</p>}
        <IoTable title="Входы" rows={task.inputs} variables={variables} onChange={inputs => set({inputs})} />
        {errorOf("outputs") && <p className="text-xs text-red-600">{errorOf("outputs")}</p>}
        <IoTable title="Выходы" rows={task.outputs} variables={[]} onChange={outputs => set({outputs})} />

        <div>
          <span className={label}>Пишет переменные</span>
          {variables.length === 0 && <p className="text-xs text-neutral-500">Переменных проекта нет — заведите на вкладке «Переменные».</p>}
          <div className="flex flex-wrap gap-3">
            {variables.map(v => (
              <label key={v.name} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={task.writes_variables.includes(v.name)} onChange={e => toggleWrite(v.name, e.target.checked)} />
                {v.name}
              </label>
            ))}
          </div>
          {errorOf("writes_variables") && <p className="text-xs text-red-600 mt-1">{errorOf("writes_variables")}</p>}
        </div>

        <div>
          <span className={label}>Скрипт (JavaScript)</span>
          <p className="text-xs text-neutral-500 mb-1">
            inputs.alias · input(alias) → {"{value, good, ageMs, stale}"} · write(alias, value) · vars.имя · setVar(имя, value) ·
            state (объект, до 64 КБ) · dt · firstRun · log.info(...) / log.warn(...)
          </p>
          <div className="border border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden">
            <CodeMirror value={task.script} height="360px" extensions={[javascript()]} theme="dark" onChange={script => set({script})} />
          </div>
          {errorOf("script") && <p className="text-xs text-red-600 mt-1">{errorOf("script")}</p>}
        </div>
      </div>

      <div className="w-80 shrink-0">
        <span className={label}>Дерево тегов</span>
        <div className="h-[600px] overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <DeviceTreePanel />
        </div>
      </div>
    </div>
  );
}
```

Ошибка синтаксиса скрипта приходит с `field: "script"` (сверено с `AutomationSetValidator`).

- [ ] **Step 3: Переменные и watchdog**

`src/components/automation/VariablesEditor.tsx`:

```tsx
"use client";

import React from "react";
import {Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/Button";
import {
  AUTOMATION_VALUE_TYPES,
  VARIABLE_TAG_PREFIX,
  type AutomationValidationError,
  type AutomationValueType,
  type AutomationVariable,
  type AutomationWatchdog,
} from "@/types/automation.types";

const input = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

interface Props {
  variables: AutomationVariable[];
  watchdog: AutomationWatchdog | null;
  errors: AutomationValidationError[];
  onVariablesChange: (variables: AutomationVariable[]) => void;
  onWatchdogChange: (watchdog: AutomationWatchdog | null) => void;
}

/**
 * Переменные проекта — значения, которые задачи вычисляют и публикуют. На схеме они
 * привязываются как тег `@var.<имя>`; записать их из монитора нельзя, пишет только задача.
 */
export function VariablesEditor({variables, watchdog, errors, onVariablesChange, onWatchdogChange}: Props) {
  const patch = (index: number, value: Partial<AutomationVariable>) =>
    onVariablesChange(variables.map((v, i) => (i === index ? {...v, ...value} : v)));

  return (
    <div className="p-4 space-y-8 max-w-4xl">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Переменные проекта</h3>
          <Button onClick={() => onVariablesChange([...variables, {name: "", value_type: "float", default_value: null, description: null}])}>
            <Plus size={14} />Переменная
          </Button>
        </div>
        <div className="grid grid-cols-[1fr_100px_140px_1fr_auto] gap-2 text-xs uppercase tracking-wider text-neutral-500">
          <span>Имя</span><span>Тип</span><span>По умолчанию</span><span>Описание</span><span />
        </div>
        {variables.map((v, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_140px_1fr_auto] gap-2 items-center">
            <input className={input} value={v.name} placeholder="pump.speedSp" onChange={e => patch(i, {name: e.target.value})} title={`${VARIABLE_TAG_PREFIX}${v.name}`} />
            <select className={input} value={v.value_type} onChange={e => patch(i, {value_type: e.target.value as AutomationValueType})}>
              {AUTOMATION_VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={input} value={v.default_value ?? ""} onChange={e => patch(i, {default_value: e.target.value === "" ? null : e.target.value})} />
            <input className={input} value={v.description ?? ""} onChange={e => patch(i, {description: e.target.value === "" ? null : e.target.value})} />
            <Button onClick={() => onVariablesChange(variables.filter((_, j) => j !== i))} title="Удалить"><Trash2 size={14} /></Button>
          </div>
        ))}
        {errors.filter(e => e.field.startsWith("variables")).map((e, i) => (
          <p key={i} className="text-xs text-red-600">{e.message}</p>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Watchdog</h3>
        <p className="text-xs text-neutral-500">
          Счётчик 0…65535, который automation пишет в тег ПЛК с заданным периодом. ПЛК по застывшему
          счётчику понимает, что автоматика остановилась, и переходит в безопасный режим.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={watchdog !== null} onChange={e => onWatchdogChange(e.target.checked ? {tag: "", period_ms: 1000} : null)} />
          Включён
        </label>
        {watchdog && (
          <div className="grid grid-cols-[1fr_160px] gap-2">
            <input className={input} placeholder="путь тега ПЛК" value={watchdog.tag} onChange={e => onWatchdogChange({...watchdog, tag: e.target.value})} />
            <input className={input} type="number" value={watchdog.period_ms} onChange={e => onWatchdogChange({...watchdog, period_ms: Math.trunc(Number(e.target.value))})} title="100 … 60 000 мс" />
          </div>
        )}
        {errors.filter(e => e.field.startsWith("watchdog")).map((e, i) => (
          <p key={i} className="text-xs text-red-600">{e.message}</p>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Проверка Task 5–6**

Run: `npx tsc --noEmit` — без ошибок; `npm run lint` — без новых ошибок.
Руками (стенд, проект 8501 после `apply-bn1-mca1-pump-pid.ps1`):
1. В шапке пункт «Автоматизация» → проект 8501: задачи набора, у каждой статус «Работает».
2. Поменять период задачи на `50` → «Сохранить» → тост «не прошёл проверку», под полем — сообщение про диапазон.
3. Вернуть `1000`, поменять название → «Сохранить» → «Сохранено, версия N+1».
4. Во второй вкладке браузера сохранить набор, в первой сохранить свою правку → тост про изменение другим пользователем.
5. «История» → восстановить предыдущую версию → набор перечитан, версия выросла на 1.
6. «Переопубликовать» → тост; в логе automation — повторная загрузка определений проекта.

- [ ] **Step 5: Commit**

```powershell
git add src/components/editor/HeaderNav.tsx "src/app/(app)/automation" src/components/automation
git commit -m "Add automation editor page"
```

---

### Task 7: Переменная проекта в привязке свойства

**Files:**
- Modify: `src/components/ui/OpenChooseTagModal.tsx`
- Modify: `src/lib/editor/tagPath.ts`
- Modify: `src/types/runtimeWrite.types.ts`

**Interfaces:**
- Consumes: `fetchAutomation` (Task 2), `VARIABLE_TAG_PREFIX`, `AutomationVariable` (Task 1).
- Produces: свойство с `property_type: "Тег"`, `tag_id: "@var.<имя>"`; `shortTagPath` не режет адрес переменной; подпись `REJECTED_VARIABLE`.

- [ ] **Step 1: Подпись переменной не режется**

`src/lib/editor/tagPath.ts` — в `shortTagPath` после `if (!path) return "";` добавить:

```ts
  // `@var.pump.speedSp` — не путь канала, а переменная проекта: префикса «проект.схема»
  // у неё нет, и срезанная подпись `speedSp` потеряла бы, что это переменная.
  if (path.startsWith("@var.")) return path;
```

- [ ] **Step 2: Отказ записи в переменную**

`src/types/runtimeWrite.types.ts`:
- в `TagWriteStatus` после `| "REJECTED_PROTOCOL_UNSUPPORTED"` добавить `| "REJECTED_VARIABLE"`;
- в `TAG_WRITE_STATUS_LABELS` после `REJECTED_PROTOCOL_UNSUPPORTED: …,` добавить:

```ts
  // Переменную проекта пишет только её задача automation, не оператор.
  REJECTED_VARIABLE: "Переменная проекта только для чтения",
```

- [ ] **Step 3: Источник тега в форме свойства**

В `src/components/ui/OpenChooseTagModal.tsx`:

1) Импорты — добавить:

```tsx
import {fetchAutomation} from "@/lib/automation/automationApi";
import {VARIABLE_TAG_PREFIX, type AutomationVariable} from "@/types/automation.types";
```

2) После `type PropertyType = …;` добавить:

```tsx
/** Откуда берётся tag_id свойства типа «Тег»: канал из дерева или переменная проекта. */
type TagSource = "channel" | "variable";

/** Типы переменной automation → типы значения свойства (у свойств словарь свой). */
const VARIABLE_VALUE_TYPE: Record<string, string> = {bool: "boolean", int: "integer", float: "float", string: "string"};
```

3) После `const [isLoading, setIsLoading] = useState(false);` добавить:

```tsx
  const initialVariable = property?.tag_id?.startsWith(VARIABLE_TAG_PREFIX)
    ? property.tag_id.slice(VARIABLE_TAG_PREFIX.length)
    : null;
  const [tagSource, setTagSource] = useState<TagSource>(initialVariable ? "variable" : "channel");
  const [variableName, setVariableName] = useState<string | null>(initialVariable);
  const [variables, setVariables] = useState<AutomationVariable[] | null>(null);
  const currentProjectId = useEditorStore((s) => s.currentProject?.id ?? null);

  // Список переменных грузим, только когда пользователь выбрал этот источник.
  useEffect(() => {
    if (tagSource !== "variable" || variables !== null || currentProjectId == null) return;
    fetchAutomation(currentProjectId)
      .then(set => setVariables(set.variables))
      .catch(() => setVariables([]));
  }, [tagSource, variables, currentProjectId]);
```

и в существующий `useEffect(() => { … }, [property])` добавить в конец тела:

```tsx
    const variable = property?.tag_id?.startsWith(VARIABLE_TAG_PREFIX)
      ? property.tag_id.slice(VARIABLE_TAG_PREFIX.length)
      : null;
    setTagSource(variable ? "variable" : "channel");
    setVariableName(variable);
```

4) После `const isTagType = propertyType === "Тег";` добавить:

```tsx
  const chosenTagId = tagSource === "variable"
    ? (variableName ? `${VARIABLE_TAG_PREFIX}${variableName}` : "")
    : (selectedDevice ?? (initialVariable ? "" : property?.tag_id) ?? "");
```

5) В `missing` строку

```tsx
    if (isTagType && !selectedDevice && !property?.tag_id) return "Выберите тег в дереве устройств";
```

заменить на

```tsx
    if (isTagType && !chosenTagId) {
      return tagSource === "variable" ? "Выберите переменную проекта" : "Выберите тег в дереве устройств";
    }
```

и массив зависимостей `useMemo` заменить на `[name, valueType, isTagType, chosenTagId, tagSource]`.

6) В `payload` строку `tag_id: isTagType ? (selectedDevice ?? property?.tag_id ?? "") : "",` заменить на:

```tsx
        tag_id: isTagType ? chosenTagId : "",
```

7) Блок `{/* Device Tree */}` — ветку `isTagType ? ( … )` заменить на:

```tsx
        {isTagType ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["channel", "variable"] as TagSource[]).map(source => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setTagSource(source)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm",
                    tagSource === source
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                  )}
                >
                  {source === "channel" ? "Канал" : "Переменная проекта"}
                </button>
              ))}
            </div>

            {tagSource === "channel" ? (
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Waypoints className="h-4 w-4 text-indigo-500" />
                  Выберите тег в дереве устройств
                </div>
                <div className="h-[360px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/70">
                  <DeviceTreePanel />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500" title={selectedDevice ?? undefined}>
                  {selectedDevice
                    ? `Выбран тег: ${shortTagPath(selectedDevice)}`
                    : "Пока тег не выбран — кнопка сохранения будет недоступна."}
                </p>
              </>
            ) : (
              <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800 p-2 space-y-1">
                {variables === null && <p className="text-sm text-gray-500 px-2 py-1">Загрузка…</p>}
                {variables?.length === 0 && (
                  <p className="text-sm text-gray-500 px-2 py-1">
                    У проекта нет переменных — заведите их на странице «Автоматизация».
                  </p>
                )}
                {variables?.map(v => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => {
                      setVariableName(v.name);
                      if (!valueType) setValueType(VARIABLE_VALUE_TYPE[v.value_type] ?? "");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm",
                      variableName === v.name
                        ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800",
                    )}
                  >
                    <span className="font-mono">{VARIABLE_TAG_PREFIX}{v.name}</span>
                    <span className="ml-2 text-xs text-gray-500">{v.value_type}{v.description ? ` · ${v.description}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
```

(ветка `) : ( … )}` для «Глобальный»/«Локальный» остаётся как была).

- [ ] **Step 4: Проверка**

Run: `npx tsc --noEmit` — без ошибок.
Руками:
1. Редактор → схема «ПИД-регуляторы» → компонент → «Добавить свойство» → тип «Тег» → «Переменная проекта»: виден список переменных набора 8501; выбор проставляет тип значения, если он был пуст.
2. Сохранить схему → открыть свойство снова: источник «Переменная проекта», переменная подсвечена.
3. Монитор → эта схема: привязанный элемент показывает значение переменной и меняется вместе с задачей.
4. «Опции» компонента → записать значение в свойство-переменную → отказ «Переменная проекта только для чтения».

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/OpenChooseTagModal.tsx src/lib/editor/tagPath.ts src/types/runtimeWrite.types.ts
git commit -m "Allow binding properties to project variables"
```

---

### Task 8: Сквозная проверка на стенде

Код не меняется — проверка цепочки целиком, после неё ветку можно вливать.

- [ ] **Step 1: Автономность**

1. Стенд поднят, набор 8501 применён, монитор открыт на «ПИД-регуляторы»: насос регулирует расход, панель «Задачи» — все «Работает».
2. Закрыть вкладку фронта (или остановить `npm run dev`) на 1–2 минуты.
3. Проверить, что задачи работали без фронта: `GET http://localhost:8080/api/automation/projects/8501/tasks` — `lastRunAtMs` свежий, `errorCount` 0.
4. Открыть монитор снова: переменные показывают текущие значения сразу, без ожидания следующего такта (replay в runtime), статусы задач пришли полным списком.

- [ ] **Step 2: Ошибка задачи видна оператору**

1. «Автоматизация» → в скрипт задачи добавить `throw new Error("проверка")` → сохранить.
2. Монитор: кнопка «Задачи» красная с числом 1, в панели — «Ошибка», текст ошибки, растущий «ошибок подряд».
3. Убрать строку, сохранить → статус вернулся в «Работает», кнопка снова синяя.

- [ ] **Step 3: Переподключение**

1. Монитор открыт, панель «Задачи» открыта.
2. Перезапустить runtime (`.\gradlew :runtime:bootRun` заново или рестарт контейнера).
3. Статус соединения проходит «Переподключение…» → «Живые данные», панель снова получает статусы без перезагрузки страницы (в WS — повторный `SUBSCRIBE_TASKS`).

- [ ] **Step 4: Влить ветку**

```powershell
git switch main
git merge --no-ff feat/automation-ui
```

---

## Self-review (сделан при написании плана)

- Спека, раздел «Фронт»: страница определений — Task 5–6; переменная в привязке — Task 7; панель статусов — Task 3–4; история — Task 1 (docType) + Task 5; ошибка записи в переменную — Task 7 Step 2. Фронт ничего не исполняет: задачи только редактируются и показываются.
- Имена сверены между задачами: `pushTaskStatuses`/`resetTaskStatuses`, `subscribeTasks`/`unsubscribeTasks`, `TASK_STATE_VIEW`, `countTaskProblems`, `AutomationSaveError.errors`, `VARIABLE_TAG_PREFIX`.
- Поля сверены с бэкендом (`feat/automation-runtime`, 6b82cef): `AutomationTaskDto`, `AutomationVariableDto`, `AutomationWatchdogDto`, `StatePublisher.publishStatus`, `AutomationStore.StatusRow`, `RuntimeWebSocketHandler` (`SUBSCRIBE_TASKS` отдаёт полный список), `DocumentVersionController` (`automation`).
- Поля ошибок сверены с `AutomationSetValidator`: `name`, `period_ms`, `timeout_ms`, `stale_after_ms`, `inputs`, `outputs`, `writes_variables`, `script`, `variables.*`, `watchdog.tag`, `watchdog.period_ms` (100…60 000).
