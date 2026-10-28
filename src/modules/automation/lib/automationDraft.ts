import type {AutomationSet, AutomationTask, AutomationWatchdog} from "@/types/automation.types";
import {stripIoHints} from "./automationTemplates";

/**
 * Черновик набора automation против сохранённого на сервере.
 *
 * Бэкенд принимает набор только целиком, но правки удобнее сохранять по одной задаче: сохранение
 * задачи — это PUT *сохранённого* набора, в котором заменена (или добавлена) одна задача. Тогда
 * незаконченные правки соседних задач на сервер не уезжают. Удаление сохраняется так же — сразу.
 */

/** JSON с отсортированными ключами: порядок полей у ответа сервера и у черновика разный. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

/**
 * Пустой таймаут бэкенд сохраняет как 100 мс, а имя — без пробелов по краям. Без этой поправки
 * только что сохранённая задача выглядела бы изменённой.
 */
const comparable = (task: AutomationTask): AutomationTask => ({
  ...stripIoHints([task])[0],
  name: task.name.trim(),
  timeout_ms: task.timeout_ms ?? 100,
});

export const sameTask = (a: AutomationTask, b: AutomationTask): boolean =>
  canonical(comparable(a)) === canonical(comparable(b));

export const sameWatchdog = (a: AutomationWatchdog | null, b: AutomationWatchdog | null): boolean =>
  canonical(a) === canonical(b);

export type TaskDraftState = "new" | "changed" | "saved";

/** Состояние задачи черновика относительно сохранённого набора. */
export const taskDraftState = (task: AutomationTask, saved: AutomationSet | null): TaskDraftState => {
  const original = task.id != null ? saved?.tasks.find(t => t.id === task.id) : undefined;
  if (!original) return "new";
  return sameTask(task, original) ? "saved" : "changed";
};

/** Есть ли в черновике хоть что-то, чего нет на сервере. */
export const isSetDirty = (draft: AutomationSet | null, saved: AutomationSet | null): boolean => {
  if (!draft || !saved) return false;
  if (draft.tasks.length !== saved.tasks.length) return true;
  if (draft.tasks.some(t => taskDraftState(t, saved) !== "saved")) return true;
  return !sameWatchdog(draft.watchdog, saved.watchdog);
};

/** Задачи сохранённого набора с одной задачей черновика: заменённой по id или добавленной в конец. */
export const tasksWith = (saved: AutomationSet, task: AutomationTask): AutomationTask[] =>
  task.id != null && saved.tasks.some(t => t.id === task.id)
    ? saved.tasks.map(t => (t.id === task.id ? task : t))
    : [...saved.tasks, task];

/**
 * Задача ответа сервера, соответствующая задаче черновика. Новая задача получила id только
 * в ответе, поэтому её ищем по имени среди задач, которых раньше не было.
 */
export const findSavedTask = (
  task: AutomationTask,
  before: AutomationSet,
  after: AutomationSet,
): AutomationTask | undefined => {
  if (task.id != null) {
    const byId = after.tasks.find(t => t.id === task.id);
    if (byId) return byId;
  }
  const known = new Set(before.tasks.map(t => t.id));
  return after.tasks.find(t => !known.has(t.id) && t.name === task.name.trim());
};

/** Чем версия отличается от предыдущей — для вкладки «История». */
export interface AutomationVersionDiff {
  added: AutomationTask[];
  removed: AutomationTask[];
  /** Пара «до / после» для задачи, которая была в обеих версиях и изменилась. */
  changed: {before: AutomationTask; after: AutomationTask}[];
  watchdogChanged: boolean;
  variablesChanged: boolean;
}

/** Содержимое версии — снимок набора той же формы, что у GET; разбираем осторожно. */
export const setOfVersionContent = (content: unknown): Pick<AutomationSet, "tasks" | "variables" | "watchdog"> | null => {
  if (!content || typeof content !== "object") return null;
  const doc = content as Partial<AutomationSet>;
  if (!Array.isArray(doc.tasks)) return null;
  return {
    tasks: doc.tasks,
    variables: Array.isArray(doc.variables) ? doc.variables : [],
    watchdog: doc.watchdog ?? null,
  };
};

export const diffVersions = (
  before: Pick<AutomationSet, "tasks" | "variables" | "watchdog"> | null,
  after: Pick<AutomationSet, "tasks" | "variables" | "watchdog">,
): AutomationVersionDiff => {
  const prev = before ?? {tasks: [], variables: [], watchdog: null};
  // Сопоставление по id, как у бэкенда: переименование — это изменение, а не удаление и добавление.
  const prevById = new Map(prev.tasks.map(t => [t.id, t]));
  const nextIds = new Set(after.tasks.map(t => t.id));
  const changed: AutomationVersionDiff["changed"] = [];
  const added: AutomationTask[] = [];
  for (const task of after.tasks) {
    const old = prevById.get(task.id);
    if (!old) added.push(task);
    else if (!sameTask(old, task)) changed.push({before: old, after: task});
  }
  return {
    added,
    removed: prev.tasks.filter(t => !nextIds.has(t.id)),
    changed,
    watchdogChanged: !sameWatchdog(prev.watchdog, after.watchdog),
    variablesChanged: canonical(prev.variables) !== canonical(after.variables),
  };
};

/** Уникальное имя для задачи, которую возвращают в набор: старое могло уже занять другая. */
export const freeTaskName = (name: string, taken: string[]): string => {
  const names = new Set(taken.map(n => n.trim()));
  if (!names.has(name.trim())) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`;
    if (!names.has(candidate)) return candidate;
  }
};

const onOff = (v: boolean) => (v ? "да" : "нет");

/** Сколько строк добавлено и удалено — грубо, по мультимножеству строк, без выравнивания. */
export const lineChanges = (before: string, after: string): {added: number; removed: number} => {
  const count = new Map<string, number>();
  for (const line of before.split("\n")) count.set(line, (count.get(line) ?? 0) + 1);
  let added = 0;
  for (const line of after.split("\n")) {
    const left = count.get(line) ?? 0;
    if (left > 0) count.set(line, left - 1);
    else added++;
  }
  const removed = [...count.values()].reduce((sum, n) => sum + n, 0);
  return {added, removed};
};

const ioLabel = (io: AutomationTask["inputs"][number]) => `${io.alias || "без alias"} = ${io.tag || "тег не задан"} (${io.value_type})`;

const ioChanges = (title: string, before: AutomationTask["inputs"], after: AutomationTask["inputs"]): string[] => {
  const lines: string[] = [];
  const prev = new Map(before.map(io => [io.alias, io]));
  const next = new Map(after.map(io => [io.alias, io]));
  for (const io of after) {
    const old = prev.get(io.alias);
    if (!old) lines.push(`${title}: добавлен ${ioLabel(io)}`);
    else if (old.tag !== io.tag || old.value_type !== io.value_type) lines.push(`${title}: ${ioLabel(old)} → ${ioLabel(io)}`);
  }
  for (const io of before) if (!next.has(io.alias)) lines.push(`${title}: удалён ${ioLabel(io)}`);
  return lines;
};

/** Что именно поменялось в задаче — строками для человека. */
export const taskFieldChanges = (before: AutomationTask, after: AutomationTask): string[] => {
  const a = comparable(before);
  const b = comparable(after);
  const lines: string[] = [];
  if (a.name !== b.name) lines.push(`название: «${a.name}» → «${b.name}»`);
  if (a.enabled !== b.enabled) lines.push(b.enabled ? "задача включена" : "задача выключена");
  if (a.period_ms !== b.period_ms) lines.push(`период: ${a.period_ms} → ${b.period_ms} мс`);
  if (a.timeout_ms !== b.timeout_ms) lines.push(`таймаут скрипта: ${a.timeout_ms} → ${b.timeout_ms} мс`);
  if (a.stale_after_ms !== b.stale_after_ms) lines.push(`вход устарел через: ${a.stale_after_ms} → ${b.stale_after_ms} мс`);
  if (a.run_on_stale !== b.run_on_stale) lines.push(`работать на устаревших входах: ${onOff(a.run_on_stale)} → ${onOff(b.run_on_stale)}`);
  lines.push(...ioChanges("вход", a.inputs, b.inputs), ...ioChanges("выход", a.outputs, b.outputs));
  const addedVars = b.writes_variables.filter(v => !a.writes_variables.includes(v));
  const removedVars = a.writes_variables.filter(v => !b.writes_variables.includes(v));
  if (addedVars.length) lines.push(`пишет переменные: + ${addedVars.join(", ")}`);
  if (removedVars.length) lines.push(`больше не пишет переменные: ${removedVars.join(", ")}`);
  if (a.script !== b.script) {
    const {added, removed} = lineChanges(a.script, b.script);
    lines.push(`скрипт изменён: +${added} / −${removed} строк`);
  }
  return lines;
};

/** Короткая сводка задачи для просмотра содержимого версии. */
export const taskSummary = (task: AutomationTask): string =>
  [
    task.enabled ? "включена" : "выключена",
    `период ${task.period_ms} мс`,
    `входов ${task.inputs.length}`,
    `выходов ${task.outputs.length}`,
    task.writes_variables.length ? `пишет ${task.writes_variables.join(", ")}` : null,
  ].filter(Boolean).join(" · ");
