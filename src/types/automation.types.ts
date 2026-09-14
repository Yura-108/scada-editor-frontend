/** Контракт сервиса automation и набора задач в editor (сверено с кодом бэкенда ec49adb, 14.09.2026). */

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
  /** epoch ms последнего такта — у DISABLED и INPUT_STALE тоже, это не «последний успешный запуск». */
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
  /** То же, что `lastRunAt` в кадре WS: имена полей в REST и WS у бэкенда разные. */
  lastRunAtMs: number | null;
  lastDurationMs: number | null;
  lastError: string | null;
  errorCount: number;
  ownerInstance: string | null;
}
