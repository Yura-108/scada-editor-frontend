// «Данные»: таблицы данных проекта (столбцы, строки), переменные, история версий.
// Внутри модуля файлы импортируют друг друга относительно, а не через этот index.
export {
  fetchProjectData, fetchProjectDataVersions, ProjectDataSaveError, reloadProjectData, restoreProjectDataVersion,
  saveProjectData,
} from "./api/projectDataApi";
export {diffDataVersions} from "./lib/dataVersionDiff";

// UI
export {compactButton} from "./ui/ColumnsEditor";
export {DataDiffView, DataVersionChanges, loadDataVersion} from "./ui/DataVersionChanges";
export {confirmRemoveTable, TablesEditor} from "./ui/TablesEditor";
export {VariablesEditor} from "./ui/VariablesEditor";
