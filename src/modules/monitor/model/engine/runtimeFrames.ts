import type {ProcedureEvent, ProcedureStatus} from "@/core/project";
import type {AutomationTaskStatus} from "@/core/automation";
import {devLog} from "@/shared/lib/devLog";
import type {RuntimeConnectionHandlers, RuntimePropertyUpdate, RuntimeTagUpdate} from "./runtimeConnection";

const log = (...args: unknown[]) => devLog("[monitor:ws]", ...args);

type FrameHandlers = Pick<RuntimeConnectionHandlers, "onUpdate" | "onSnapshot" | "onTasks" | "onRelease" | "onActionDenied">;

/**
 * Разбор кадра WS и передача его обработчикам соединения: `SNAPSHOT`, `TREE_CHANGED`,
 * `ACTION_DENIED`, `UPDATE`. `forgetScene` — TREE_CHANGED снял подписку на сцену на сервере,
 * соединение забывает её тоже.
 */
export function routeRuntimeFrame(
  data: unknown,
  {onUpdate, onSnapshot, onTasks, onRelease, onActionDenied}: FrameHandlers,
  forgetScene: () => void,
) {
  let msg: {
    type?: string;
    tags?: RuntimeTagUpdate[] | null;
    properties?: RuntimePropertyUpdate[] | null;
    // В UPDATE — события хода рецепта, в SNAPSHOT — статусы активных процедур проекта.
    procedures?: ProcedureEvent[] | ProcedureStatus[] | null;
    // Статусы задач automation — только после SUBSCRIBE_TASKS.
    tasks?: AutomationTaskStatus[] | null;
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
      + ` активных процедур: ${procedures.length}`,
    );
    onSnapshot?.(tags, properties, procedures);
    return;
  }
  if (msg?.type === "TREE_CHANGED") {
    log(`TREE_CHANGED — проект переключён на выпуск ${msg.versionNo}, подписка на сцену снята сервером`);
    forgetScene();
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
}
