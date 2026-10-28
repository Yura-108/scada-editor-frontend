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
  diffVersions, findSavedTask, freeTaskName, isSetDirty, sameWatchdog, taskDraftState, tasksWith,
} from "./lib/automationDraft";
export {missingVariables, stripIoHints, taskToTemplate, templateToDraftTask} from "./lib/automationTemplates";

// UI
export {AutomationDiffView, AutomationVersionChanges, loadAutomationVersion} from "./ui/AutomationVersionChanges";
export {compactButton} from "./ui/formStyles";
export {openTemplateModal} from "./ui/OpenTemplateModal";
export {TaskEditor} from "./ui/TaskEditor";
export {TemplatePalette} from "./ui/TemplatePalette";
export {WatchdogEditor} from "./ui/WatchdogEditor";
