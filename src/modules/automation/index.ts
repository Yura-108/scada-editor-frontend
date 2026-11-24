// «Автоматизация»: задачи, шаблоны задач, сторожевые таймеры, история версий набора.
// Запросы набора — в core/automation (их же берут «Данные»). Снаружи нужна только страница
// раздела: проект ей передаёт `app/(app)/automation`. Внутри модуля файлы импортируют друг
// друга относительно, а не через этот index.
export {AutomationPage} from "./ui/AutomationPage";
export * from "./types/automationTemplate.types";
