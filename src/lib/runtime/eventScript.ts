import type {ElementEventHandler} from "@/types/binding.types";
import {modernizeScopeCode, type TagScope} from "@/lib/runtime/bindingScope";
import {buildRawScope, toScopeValue, type BindingIntent} from "@/lib/runtime/executeBinding";

/**
 * Компиляция и исполнение обработчиков событий (onClick/onDoubleClick) — чистый
 * модуль без зависимостей от стора (тестируется headless; переиспользуется
 * тест-прогоном в редакторе события).
 *
 * Отличие от биндингов: обработчик запускается по КЛИКУ (а не по изменению
 * значения) и умеет ПИСАТЬ значения свойств через `setProperty("Имя", значение)`
 * (запись уходит в тот же буфер, что и серверные properties[] — на неё реагируют
 * биндинги других элементов). `setProp`/`setState` меняют сам элемент.
 * `openScene(имя | id)` просит монитор открыть другую схему проекта — интентом в
 * результате, а не колбэком: модуль остаётся чистым, и тест-прогон редактора видит
 * переход, ничего не открывая.
 */

/** Запись значения в свойство объекта (ключ маршрутизации — propertyId). */
export interface PropertyWrite {
  propertyId: number;
  value: string;
}

export interface CompiledEventScript {
  elementKey: string;
  scope: TagScope;
  fn: (...args: unknown[]) => unknown;
}

/** Цель `openScene`: имя схемы или её id. Сопоставление — `resolveSceneTarget`. */
export type SceneTarget = string | number;

/** Аргументы действия (`ACTION.args`, docs/contract/2026-10-02-action-args-contract.md). */
export type ActionArgs = Record<string, unknown>;

/** Пункт меню выбора `showMenu`: подпись и серверный скрипт, который запустится с `args`. */
export interface MenuChoice {
  label: string;
  script: string;
  args?: ActionArgs;
}

/** Предел бэкенда на сериализованный `args`: длиннее — действие отклоняется молча. */
export const ACTION_ARGS_MAX_LENGTH = 4096;

/**
 * Проверка и снимок аргументов действия перед отправкой.
 *
 * Бэкенд на кривые `args` не отвечает: массив/строку/число отбрасывает вместе со всем
 * сообщением, слишком длинный объект — отклоняет; оператор не узнал бы, что команда не
 * ушла. Поэтому отсекаем здесь и говорим почему. Снимок через JSON — значение на момент
 * вызова (скрипт не изменит его задним числом) и без функций/undefined.
 *
 * `undefined` — аргументов нет, поле не отправляется.
 */
export const normalizeActionArgs = (
  args: unknown,
): {args?: ActionArgs} | {error: string} => {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    return {error: "аргументы должны быть объектом { имя: значение }"};
  }
  let json: string;
  try {
    json = JSON.stringify(args);
  } catch (err) {
    return {error: `аргументы не сериализуются в JSON: ${err instanceof Error ? err.message : String(err)}`};
  }
  if (json.length > ACTION_ARGS_MAX_LENGTH) {
    return {error: `аргументы длиннее ${ACTION_ARGS_MAX_LENGTH} символов — сервер их не примет`};
  }
  const snapshot = JSON.parse(json) as ActionArgs;
  return Object.keys(snapshot).length ? {args: snapshot} : {};
};

export type EventExecResult =
  | {writes: PropertyWrite[]; intents: BindingIntent[]; openScene?: SceneTarget; menu?: MenuChoice[]}
  | {error: string};

/** Компилирует обработчик; ошибка синтаксиса возвращается строкой, не бросается. */
export const compileEventScript = (
  elementKey: string,
  handler: ElementEventHandler,
  scope: TagScope,
): CompiledEventScript | {error: string} => {
  try {
    const fn = new Function(
      ...scope.names,
      "RAW",
      "setProperty",
      "setProp",
      "setState",
      "self",
      "runScript",
      "openScene",
      "showMenu",
      // Старый синтаксис «Имя.V» переводим на новый — см. modernizeScopeCode.
      modernizeScopeCode(handler.code, scope.names),
    ) as (...args: unknown[]) => unknown;
    return {elementKey, scope, fn};
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }
};

/**
 * Исполняет скомпилированный обработчик над текущими значениями тегов/свойств.
 * Возвращает записи в свойства (для маршрутизации на биндинги) и интенты
 * setProp/setState на сам элемент. «Последний вызов выигрывает» по цели.
 *
 * `runScript(name, args?)` — мост к серверному скрипту (запись тега в ПЛК): в мониторе
 * колбэк шлёт ACTION по WS; в тест-прогоне редактора — записывает вызов для показа.
 * Негодные `args` вызов отменяют (см. normalizeActionArgs) — ошибка в консоль.
 *
 * `showMenu(items)` — меню выбора у точки клика; как и `openScene`, это интент в
 * результате (`menu`), показывает его монитор. Последний вызов выигрывает.
 */
export const executeEventScript = (
  cb: CompiledEventScript,
  valuesByTagId: ReadonlyMap<string, string | null>,
  valuesByPropertyId: ReadonlyMap<number, string>,
  self?: unknown,
  runScript?: (name: string, args?: ActionArgs) => void,
): EventExecResult => {
  const writes = new Map<number, PropertyWrite>();
  let stateIntent: {kind: "state"; stateName: string} | null = null;
  const propIntents = new Map<string, {kind: "prop"; key: string; value: unknown}>();

  // Запись значения в свойство по ИМЕНИ переменной скоупа (property ref).
  const setProperty = (name: unknown, value: unknown) => {
    if (typeof name !== "string" || !(name in cb.scope.propertyIdByName)) return;
    const propertyId = cb.scope.propertyIdByName[name];
    writes.set(propertyId, {propertyId, value: value == null ? "" : String(value)});
  };
  const setProp = (key: unknown, value: unknown) => {
    if (typeof key === "string" && key) propIntents.set(key, {kind: "prop", key, value});
  };
  const setState = (stateName: unknown) => {
    if (typeof stateName === "string" && stateName) stateIntent = {kind: "state", stateName};
  };
  // Запуск серверного скрипта по имени — делегируем колбэку движка (шлёт ACTION по WS).
  const runScriptFn = (name: unknown, args?: unknown) => {
    if (typeof name !== "string" || !name || !runScript) return;
    const checked = normalizeActionArgs(args);
    if ("error" in checked) {
      console.warn(`[monitor:event] runScript("${name}") не отправлен: ${checked.error}`);
      return;
    }
    runScript(name, checked.args);
  };
  // Меню выбора: битый пункт отбрасываем, а не роняем всё меню — список часто строится
  // из значения тега, где пустые и «none»-слоты обычны.
  let menu: MenuChoice[] | undefined;
  const showMenu = (items: unknown) => {
    if (!Array.isArray(items)) return;
    const choices: MenuChoice[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const {label, script, args} = item as Record<string, unknown>;
      if (typeof label !== "string" || !label.trim() || typeof script !== "string" || !script) continue;
      const checked = normalizeActionArgs(args);
      if ("error" in checked) {
        console.warn(`[monitor:event] showMenu: пункт «${label}» пропущен — ${checked.error}`);
        continue;
      }
      choices.push({label, script, ...(checked.args ? {args: checked.args} : {})});
    }
    menu = choices.length ? choices : undefined;
  };
  // Переход на другую схему. Последний вызов выигрывает — как у setState.
  let sceneTarget: SceneTarget | undefined;
  const openScene = (target: unknown) => {
    if (typeof target === "string" && target.trim()) sceneTarget = target;
    else if (typeof target === "number" && Number.isSafeInteger(target)) sceneTarget = target;
  };

  const rawOf = (name: string): string | null | undefined =>
    name in cb.scope.tagIdByName
      ? valuesByTagId.get(cb.scope.tagIdByName[name])
      : valuesByPropertyId.get(cb.scope.propertyIdByName[name]);

  const args = cb.scope.names.map(name => toScopeValue(rawOf(name)));

  try {
    cb.fn(
      ...args,
      buildRawScope(cb.scope.names, rawOf),
      setProperty,
      setProp,
      setState,
      self ?? null,
      runScriptFn,
      openScene,
      showMenu,
    );
  } catch (err) {
    return {error: err instanceof Error ? err.message : String(err)};
  }

  const intents: BindingIntent[] = [...propIntents.values()];
  if (stateIntent) intents.push(stateIntent);
  return {
    writes: [...writes.values()],
    intents,
    ...(sceneTarget !== undefined ? {openScene: sceneTarget} : {}),
    ...(menu ? {menu} : {}),
  };
};

/**
 * Обработчик сам ничего не пишет — только переводит на другую схему или показывает меню
 * выбора, — и спрашивать оператора «Выполнить действие?» на клике незачем (см.
 * confirmMonitorAction). Пункт меню выбора подтверждается отдельно, когда его выбирают:
 * без этого исключения оператор получал бы два диалога на одну команду.
 *
 * Разбор статический, а не холостым прогоном: скрипт не исполняется дважды, и ошибка
 * всегда в безопасную сторону — любое упоминание `runScript` (запись в ПЛК через сервер)
 * или `setProperty` (запись свойства, на которую реагируют чужие биндинги) оставляет
 * диалог, даже в ветке условия или в комментарии. `setProp`/`setState` меняют лишь вид
 * самого элемента и не мешают.
 */
export const isNonWritingScript = (code: string | undefined | null): boolean =>
  typeof code === "string"
  && /\b(openScene|showMenu)\s*\(/.test(code)
  && !/\b(runScript|setProperty)\b/.test(code);
