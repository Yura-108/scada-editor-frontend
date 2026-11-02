// «Данные»: таблицы данных проекта (столбцы, строки), переменные, история версий.
// Внутри модуля файлы импортируют друг друга относительно, а не через этот index.
export {
  fetchProjectData, fetchProjectDataVersions, ProjectDataSaveError, reloadProjectData, restoreProjectDataVersion,
  saveProjectData,
} from "./api/projectDataApi";
export {diffDataVersions} from "./lib/dataVersionDiff";
export {useTablesDocument} from "./model/useTablesDocument";
export {useVariablesDocument} from "./model/useVariablesDocument";

// UI
export {compactButton} from "./ui/ColumnsEditor";
export {confirmRestoreDataVersion} from "./ui/confirmRestoreDataVersion";
export {DATA_HELP, type DataTab} from "./ui/dataHelp";
export {DataDiffView, DataVersionChanges, loadDataVersion} from "./ui/DataVersionChanges";
export {confirmRemoveTable, TablesEditor} from "./ui/TablesEditor";
export {VariablesEditor} from "./ui/VariablesEditor";
export * from "./types/projectData.types";
