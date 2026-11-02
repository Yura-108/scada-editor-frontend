// «Автоматизация»: задачи, шаблоны задач, сторожевые таймеры, история версий набора.
// Запросы набора — в core/automation (их же берут «Данные»). Внутри модуля файлы
// импортируют друг друга относительно, а не через этот index.
export {
  templateKeys,
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from "./api/templates";

// Чистые функции черновика и шаблонов
export {
  diffVersions, findSavedTask, freeTaskName, isSetDirty, newTask, sameWatchdog, taskDraftState, tasksWith,
} from "./lib/automationDraft";
export {missingVariables, stripIoHints, taskToTemplate, templateToDraftTask} from "./lib/automationTemplates";

// Документ набора и действия над задачами
export {useAutomationDocument} from "./model/useAutomationDocument";
export {useTaskActions} from "./model/useTaskActions";

// UI
export {AUTOMATION_HELP, AUTOMATION_TABS, type AutomationTab} from "./ui/automationHelp";
export {confirmRestoreAutomationVersion} from "./ui/confirmRestoreAutomationVersion";
export {AutomationDiffView, AutomationVersionChanges, loadAutomationVersion} from "./ui/AutomationVersionChanges";
export {compactButton} from "./ui/formStyles";
export {openTemplateModal} from "./ui/OpenTemplateModal";
export {TaskEditor} from "./ui/TaskEditor";
export {TemplatePalette} from "./ui/TemplatePalette";
export {WatchdogEditor} from "./ui/WatchdogEditor";
export * from "./types/automationTemplate.types";
