// Права пользователя: в проекте, в действии монитора, отказы бэкенда. Внутри core/access файлы
// импортируют друг друга относительно, а не через этот index.
export {bindCurrentProjectStore, type CurrentProjectState, type CurrentProjectStore, type ProjectWithAccess} from "./currentProject";
