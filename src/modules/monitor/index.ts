// Монитор: движок (WS, привязки, скрипты), архив и плеер, процедуры, плавающие окна.
// Внутри модуля файлы импортируют друг друга относительно, а не через этот index.
export {registerMonitorDialogs} from "./model/registerMonitorDialogs";
export {procedureKeys, useMonitorRecipes, useProcedureLevels, type MonitorRecipes} from "./api/procedures";
export {ACTION_KIND_LABEL, fetchActionLog, type ActionKind, type ActionLogFilter, type ActionLogRecord} from "./api/actionLog";

// Движок, архив, процедуры
export {useRuntimeEngine, type RuntimeMode} from "./model/engine/useRuntimeEngine";
export type {RuntimeStatus} from "./model/engine/runtimeConnection";
export {useArchiveReplay} from "./model/archive/useArchiveReplay";
export {useProcedureSync} from "./model/procedures/useProcedureSync";
export {useAutomationTasksStore} from "./model/useAutomationTasksStore";
export {closeFloatingWindows} from "./model/useFloatingWindowsStore";

// UI
export {ArchivePlayerBar} from "./ui/ArchivePlayerBar";
export {AutomationTaskPanel, countTaskProblems, TASK_STATE_VIEW} from "./ui/AutomationTaskPanel";
export {FloatingWindowsLayer} from "./ui/FloatingWindowsLayer";
export {openObjectInspectorModal} from "./ui/ObjectInspectorModal";
export {ProcedureHud} from "./ui/ProcedureHud";
export {ProcedurePanel} from "./ui/ProcedurePanel";
