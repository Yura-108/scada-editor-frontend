/** Права и отказы (docs/contract/2026-10-15-access-roles-contract.md). */

/** Галочки пользователя в одном проекте. `level` — 1…10, только вместе с `operate`. */
export interface ProjectGrant {
  view: boolean;
  operate: boolean;
  edit: boolean;
  level: number | null;
}

export const NO_GRANT: ProjectGrant = {view: false, operate: false, edit: false, level: null};

/** Администратору можно всё, уровень 10 — независимо от того, что пришло в `projects`. */
export const ADMIN_GRANT: ProjectGrant = {view: true, operate: true, edit: true, level: 10};

export type DenyReason =
  | "NO_USER"
  | "NO_PROJECT_ACCESS"
  | "NO_OPERATE"
  | "NO_EDIT"
  | "LEVEL_TOO_LOW"
  | "PATH_NOT_ALLOWED"
  | "NOT_ADMIN"
  | "USER_DISABLED"
  | "ACCESS_NOT_READY";

/** Тело отказа одинаково во всех сервисах: 403 (и 401 для NO_USER). */
export interface AccessDenial {
  error: "FORBIDDEN";
  reason: DenyReason;
  /** Только у LEVEL_TOO_LOW; в ACTION_DENIED может прийти `null`. */
  requiredLevel?: number | null;
}

/** Уровни операций процедуры проекта; `null` — уровень 1. */
export interface ProcedureLevels {
  start: number | null;
  confirm: number | null;
  pause: number | null;
  resume: number | null;
  jump: number | null;
  abort: number | null;
}

export type ProcedureOperation = keyof ProcedureLevels;

export const PROCEDURE_OPERATIONS: ProcedureOperation[] = ["start", "confirm", "pause", "resume", "jump", "abort"];

export const EMPTY_PROCEDURE_LEVELS: ProcedureLevels = {
  start: null, confirm: null, pause: null, resume: null, jump: null, abort: null,
};

/** Уровни доступа — от 1 до 10. */
export const MIN_ACCESS_LEVEL = 1;
export const MAX_ACCESS_LEVEL = 10;
