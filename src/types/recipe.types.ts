/**
 * Процедурный рецепт — манифест тегов плюс упорядоченные шаги.
 *
 * Контракт: `docs/contract/2026-09-09-recipe-steps-contract.md` (сверено с кодом бэкенда
 * на `origin/main`: `editor/dto/recipe/*`, `runtime/dto/Procedure*`, `runtime/stream/ProcedureEvent`).
 *
 * Рецепт больше не набор значений и ни к какому компоненту не привязан: он описывает
 * ПРОЦЕДУРУ, которую рантайм проходит по шагам — на входе в шаг пишет теги, потом ждёт
 * выполнения условия перехода. Прежние `component_id`/`type`/`values` и разовое применение
 * (`POST /api/runtime/recipes/apply`) удалены с обеих сторон.
 */

/**
 * Тег манифеста: всё, что рецепт вправе записать.
 *
 * `name` — КОРОТКОЕ имя, которым на тег ссылаются шаги (`RecipeStepAction.tag`);
 * `tag` — путь канала в проекте. Перепутать легко, а бэкенд ответит 400 со списком
 * необъявленных имён.
 */
export interface RecipeTag {
  name: string;
  tag: string;
  /**
   * Ровно `"number" | "bool" | "string"` — по нему бэкенд проверяет `action[].value`
   * при сохранении (`RecipeServiceImpl.requireTypeMatch`).
   *
   * Любое другое значение попадает в `default -> true` и проверку молча ОТКЛЮЧАЕТ, поэтому
   * писать сюда «float» из базы каналов нельзя: 400 не будет, но и защиты не будет тоже.
   * Пусто/не задано — тоже без проверки.
   */
  value_type?: RecipeValueType;
  /** Человекочитаемое имя тега для интерфейса. */
  description?: string;
}

/** Словарь типов, который понимает валидатор бэкенда. */
export type RecipeValueType = "number" | "bool" | "string";

export const RECIPE_VALUE_TYPES: {value: RecipeValueType; label: string}[] = [
  {value: "number", label: "Число"},
  {value: "bool", label: "Логический"},
  {value: "string", label: "Строка"},
];

/** Запись действия шага: короткое имя тега из манифеста и значение в естественном типе. */
export interface RecipeStepAction {
  /** Ссылка на `RecipeTag.name`, НЕ путь тега. */
  tag: string;
  value: unknown;
}

export interface RecipeStep {
  name: string;
  /** Выполняется при входе в шаг. Пустой массив допустим — шаг без записи (ждём подтверждения). */
  action: RecipeStepAction[];
  /**
   * JS-условие перехода к следующему шагу. `null`/пусто — шаг завершается сразу после действия.
   *
   * Исполняет его РАНТАЙМ, фронт не разбирает и не запускает — для нас это текстовое поле.
   * В области видимости скрипта: `elapsedMs`, `confirmed`, `readProjectTag(path)` (путь тега,
   * не короткое имя).
   */
  condition_script: string | null;
  /**
   * Процедуру не останавливает — лишь помечает шаг «завис» событием `STALLED`,
   * если условие не стало истинным за это время.
   */
  timeout_ms: number | null;
}

export interface Recipe {
  /** Слаг из имени; выделяется один раз и при переименовании не меняется. */
  id: string;
  name: string;
  tags: RecipeTag[];
  steps: RecipeStep[];
}

/** Тело POST/PUT — то же, что рецепт, без выданного сервером `id`. */
export type RecipeCreatePayload = Omit<Recipe, "id">;

/* ─────────────────────────── выполнение (runtime) ─────────────────────────── */

/** Состояние выполняющейся процедуры. Ответ `start`/`status`/`confirm`/`jump`. */
export interface ProcedureStatus {
  recipeId: string;
  stepIndex: number;
  /** `null`, когда процедура уже `completed`. */
  stepName: string | null;
  elapsedMs: number;
  confirmed: boolean;
  completed: boolean;
  stalled: boolean;
}

/**
 * Вид события хода процедуры. На бэкенде это enum, но список держим ОТКРЫТЫМ:
 * неизвестный код показываем как информационное сообщение, а не роняем панель.
 */
export type ProcedureEventKind =
  | "STEP_STARTED"
  | "STEP_COMPLETED"
  | "WRITE_FAILED"
  | "STALLED"
  | "COMPLETED"
  | "ABORTED"
  | string;

/** Событие из массива `procedures[]` кадра WS. */
export interface ProcedureEvent {
  recipeId: string;
  /** `null` у `COMPLETED`/`ABORTED` (шага уже нет) и у `WRITE_FAILED`. */
  stepIndex: number | null;
  /** `null` у `COMPLETED`/`ABORTED`. */
  stepName: string | null;
  kind: ProcedureEventKind;
  message: string | null;
}

/** `GET /resume-guess` — только предположение, ничего не меняет. */
export interface ProcedureResumeGuess {
  suggestedStepIndex: number;
}

/** Событие завершает процедуру: текущего шага после него нет. */
export const isTerminalProcedureEvent = (kind: ProcedureEventKind): boolean =>
  kind === "COMPLETED" || kind === "ABORTED";

/** Событие, о котором оператора надо предупредить отдельно. */
export const isProcedureAlert = (kind: ProcedureEventKind): boolean =>
  kind === "WRITE_FAILED" || kind === "STALLED";
