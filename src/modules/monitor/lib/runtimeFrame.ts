import type {ProcedureEvent, ProcedureStatus} from "@/types/recipe.types";
import type {AutomationTaskStatus} from "@/types/automation.types";
import type {ActiveAlarm} from "../types";
import {devLog} from "@/shared/lib/devLog";
// переедет в модуль вместе с соединением (шаг 8)
import type {
  RuntimeConnectionHandlers,
  RuntimePropertyUpdate,
  RuntimeTagUpdate,
} from "@/lib/runtime/runtimeConnection";

/** Обработчики, которым раздаются кадры сокета. */
export type RuntimeFrameHandlers = Pick<
  RuntimeConnectionHandlers,
  "onUpdate" | "onSnapshot" | "onTasks" | "onRelease" | "onActionDenied" | "onAlarms"
>;

const log = (...args: unknown[]) => devLog("[monitor:ws]", ...args);

/**
 * Разбор одного кадра монитора и раздача его обработчикам.
 *
 * `onTreeChanged` — до вызова `onRelease`: TREE_CHANGED снимает подписку на сцену на сервере,
 * и соединение должно забыть её тоже.
 */
export function handleRuntimeFrame(
  data: unknown,
  {onUpdate, onSnapshot, onTasks, onRelease, onActionDenied, onAlarms}: RuntimeFrameHandlers,
  onTreeChanged: () => void,
): void {
  let msg: {
    type?: string;
    tags?: RuntimeTagUpdate[] | null;
    properties?: RuntimePropertyUpdate[] | null;
    // В UPDATE — события хода рецепта, в SNAPSHOT — статусы активных процедур проекта.
    procedures?: ProcedureEvent[] | ProcedureStatus[] | null;
    // Статусы задач automation — только после SUBSCRIBE_TASKS.
    tasks?: AutomationTaskStatus[] | null;
    // Аварии ПЛК: в SNAPSHOT — всегда, в UPDATE — полный список, если изменился, иначе null.
    alarms?: ActiveAlarm[] | null;
    // TREE_CHANGED — номер нового prod-выпуска.
    versionNo?: number;
    // ACTION_DENIED — какое нажатие отклонено и почему.
    scriptId?: number;
    reason?: string;
    requiredLevel?: number | null;
  };
  try {
    msg = JSON.parse(String(data));
  } catch {
    console.warn("[monitor:ws] битый JSON в сообщении, игнорирую:", data);
    return;
  }
  if (msg?.type === "SNAPSHOT") {
    const tags = msg.tags ?? [];
    const properties = msg.properties ?? [];
    const procedures = (msg.procedures ?? []) as ProcedureStatus[];
    log(
      `SNAPSHOT — тегов: ${tags.length}, свойств: ${properties.length},`
      + ` активных процедур: ${procedures.length}, аварий: ${msg.alarms?.length ?? 0}`,
    );
    onSnapshot?.(tags, properties, procedures);
    onAlarms?.(Array.isArray(msg.alarms) ? msg.alarms : []);
    return;
  }
  if (msg?.type === "TREE_CHANGED") {
    log(`TREE_CHANGED — проект переключён на выпуск ${msg.versionNo}, подписка на сцену снята сервером`);
    onTreeChanged();
    if (typeof msg.versionNo === "number") onRelease?.(msg.versionNo, true);
    return;
  }
  if (msg?.type === "ACTION_DENIED") {
    log(`ACTION_DENIED — scriptId=${msg.scriptId}, причина ${msg.reason}${msg.requiredLevel != null ? `, нужен уровень ${msg.requiredLevel}` : ""}`);
    if (typeof msg.scriptId === "number" && typeof msg.reason === "string") {
      onActionDenied?.({
        scriptId: msg.scriptId,
        reason: msg.reason,
        requiredLevel: typeof msg.requiredLevel === "number" ? msg.requiredLevel : null,
      });
    }
    return;
  }
  if (msg?.type !== "UPDATE") {
    log(`сообщение неизвестного типа «${msg?.type}», игнорирую`);
    return;
  }
  // Ответ на ACTION приходит с tags === null (не []) — нормализация обязательна.
  const tags = msg.tags ?? [];
  const properties = msg.properties ?? [];
  const procedures = msg.procedures ?? [];
  if (tags.length || properties.length || procedures.length) {
    console.groupCollapsed(
      `[monitor:ws] UPDATE — тегов: ${tags.length}, свойств: ${properties.length},`
      + ` событий процедуры: ${procedures.length}`,
    );
    if (tags.length) console.table(tags);
    if (properties.length) console.table(properties);
    if (procedures.length) console.table(procedures);
    console.groupEnd();
  }
  onUpdate(tags, properties, procedures as ProcedureEvent[]);
  if (msg.tasks?.length) onTasks?.(msg.tasks);
  if (Array.isArray(msg.alarms)) {
    log(`UPDATE — список аварий изменился, аварий: ${msg.alarms.length}`);
    onAlarms?.(msg.alarms);
  }
}
