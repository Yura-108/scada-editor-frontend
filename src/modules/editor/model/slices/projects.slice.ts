import {toast} from "sonner";
import type {EditorState} from "../editorStore";
import type {AutobindReport} from "@/types/autobind.types";
// переедут в core/project вместе с остальным lib (шаг 8)
import {normalizeProjectList, toEditorProject, type EditorProject, createRelease, NoProdReleaseError, putInOperation, setProdRelease, type CreatedRelease, rememberProject} from "@/core/project";
import {clearCanvasPointerWorld} from "@/lib/editor/canvasPointer";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {editorSession} from "../editorSession";
import {editorStore} from "../editorStoreRef";
import {runtimeInfoPatch, saveBeforeProjectAction} from "../projectActions";
import {requestAutobind, requestCreateProject, requestProjectList, requestRuntimeInfo} from "../../api/projects";
import {
  deleteComponentsRequest, discardVersionPreview, getErrorMessage, hasUnsavedWork, parseBackendErrorMessage,
} from "../editorStoreInternals";

/**
 * Зона «Проекты» стора редактора: список проектов, выбранный проект, флаг эксплуатации,
 * выпуски и автопривязка. Правила — docs/domain/projects-and-releases.md и access-roles.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6). Смена проекта
 * сбрасывает документ и сцены, выпуск зовёт сохранение, — поэтому зависимости здесь весь
 * `EditorState`. Запросы — `api/projects.ts`, общие куски действий — `model/projectActions.ts`.
 */
export interface ProjectsSlice {
  currentProject: EditorProject | null;
  projectList: EditorProject[];
  /**
   * Введён ли проект в эксплуатацию (`projectId` → флаг). Рантайм поднимает ТОЛЬКО такие
   * проекты: у остальных нет ни телеметрии, ни onChange, ни процедур, и монитор получает
   * 409 на создание сессии.
   *
   * Отдельной картой, а не полем `EditorProject`: на бэкенде это отдельная таблица, и в
   * списке проектов флаг не приходит. Известен не для всех проектов — отсутствие ключа
   * означает «ещё не спрашивали», а не «выключен».
   */
  projectRuntimeFlags: Record<number, boolean>;
  /** prod-выпуск проекта (`projectId` → номер; null — не назначен). Из того же `…/runtime`. */
  projectProdVersions: Record<number, number | null>;
  loadProjectList: () => Promise<EditorProject[] | void>;
  loadProjectRuntimeFlag: (projectId: number) => Promise<void>;
  setProjectInOperation: (projectId: number, inOperation: boolean) => Promise<void>;
  /**
   * «Выпустить»: снимок СОХРАНЁННОГО черновика проекта. Несохранённую правку открытой схемы
   * сначала предлагает сохранить — иначе в выпуск ушло бы не то, что видно на холсте.
   * null — отказ или ошибка (тост уже показан).
   */
  releaseProject: (projectId: number, comment: string) => Promise<CreatedRelease | null>;
  /** «Сделать prod»: работающий проект переключится сам, мониторы получат TREE_CHANGED. */
  makeProdRelease: (projectId: number, versionNo: number) => Promise<boolean>;
  /**
   * Автопривязка проекта к базе каналов. Возвращает отчёт, а не `void` как соседи:
   * его показывает диалог. Ошибку действие рисует тостом само и отдаёт `null`.
   */
  autobindProject: (projectId: number, channelRoot: string) => Promise<AutobindReport | null>;
  createProject: (name: string) => Promise<EditorProject | void>;
  deleteProject: (id: number) => Promise<void>;
  setCurrentProject: (project: EditorProject | null) => void;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createProjectsSlice = (set: EditorSet, get: () => EditorState): ProjectsSlice => ({
  currentProject: null,
  projectList: [],
  projectRuntimeFlags: {},
  projectProdVersions: {},

  loadProjectList: async () => {
    try {
      const result = await requestProjectList();
      if (!result.ok) throw new Error(parseBackendErrorMessage(result.status, result.text));

      const projects = normalizeProjectList(result.data);
      set({projectList: projects});
      return projects;
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Ошибка загрузки списка проектов"));
    }
  },
  /**
   * Флаг эксплуатации живёт отдельным эндпоинтом, поэтому спрашивается точечно.
   * Ошибку не показываем тостом: это фоновая подробность списка, и её недоступность
   * не должна выглядеть сбоем — бейдж просто не появится.
   */
  loadProjectRuntimeFlag: async (projectId: number) => {
    try {
      const info = await requestRuntimeInfo(projectId);
      if (!info) return;
      set(state => runtimeInfoPatch(state, projectId, info));
    } catch (err: unknown) {
      console.error(err);
    }
  },
  /**
   * Ввод и вывод из эксплуатации. Пишем точечно, НЕ через `setCurrentProject`: тот
   * разрушительный — гасит открытую схему, элементы, список сцен и историю undo.
   */
  setProjectInOperation: async (projectId: number, inOperation: boolean) => {
    const adopt = (info: {inOperation: boolean; prodVersionNo: number | null}) =>
      set(state => runtimeInfoPatch(state, projectId, info));
    try {
      let info;
      try {
        info = await putInOperation(projectId, inOperation);
      } catch (err) {
        // Runtime крутит только prod-выпуск: без него вводить нечего. Предлагаем выпустить
        // текущий черновик, сделать его prod и повторить — ровно то, чего хотел пользователь.
        if (!(err instanceof NoProdReleaseError)) throw err;
        const ok = await confirmModal({
          title: "У проекта нет prod-выпуска",
          description: "Монитор и runtime работают только по выпуску. Выпустить текущий "
            + "сохранённый черновик, сделать его prod и ввести проект в эксплуатацию?"
            + (hasUnsavedWork() ? " Несохранённые правки открытой схемы в выпуск не попадут." : ""),
          confirmLabel: "Выпустить и ввести",
        });
        if (!ok) return;
        const release = await createRelease(projectId, "Ввод в эксплуатацию");
        await setProdRelease(projectId, release.version_no);
        info = await putInOperation(projectId, inOperation);
      }
      adopt(info);
      toast.success(info.inOperation ? "Проект введён в эксплуатацию" : "Проект выведен из эксплуатации");
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Ошибка переключения эксплуатации"));
    }
  },
  releaseProject: async (projectId, comment) => {
    const proceed = await saveBeforeProjectAction(get, projectId, {
      title: "Сохранить схему перед выпуском?",
      description: "Выпуск снимает то, что сохранено на сервере. Несохранённые правки "
        + "открытой схемы в него не попадут.",
      confirmLabel: "Сохранить и выпустить",
    });
    if (!proceed) return null;
    try {
      const release = await createRelease(projectId, comment);
      if (release.unchanged) {
        toast.info(`Изменений с прошлого выпуска нет — остаётся выпуск №${release.version_no}`);
      } else {
        toast.success(`Выпуск №${release.version_no} создан`);
      }
      return release;
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Не удалось выпустить проект"));
      return null;
    }
  },
  makeProdRelease: async (projectId, versionNo) => {
    try {
      const info = await setProdRelease(projectId, versionNo);
      set(state => runtimeInfoPatch(state, projectId, info));
      toast.success(info.inOperation
        ? `Выпуск №${versionNo} — prod: проект переключён, мониторы перечитают схемы`
        : `Выпуск №${versionNo} — prod: заработает при вводе в эксплуатацию`);
      return true;
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Не удалось сделать выпуск prod"));
      return false;
    }
  },
  /**
   * Автопривязка: компонент по своему имени находит объект в базе каналов, а теговое
   * свойство по своему имени — поле. Совпавшие теги ПЕРЕЗАПИСЫВАЮТСЯ, и каждая
   * изменённая сцена получает версию `MANUAL` — отменяется это восстановлением
   * предыдущей версии, а не повторным запросом.
   */
  autobindProject: async (projectId: number, channelRoot: string) => {
    const {currentProject} = get();

    // Автопривязка пишет новую версию сцены: несохранённая правка после неё упрётся в
    // расхождение версий (слияние или 409). Поэтому спрашиваем ДО запроса.
    const proceed = await saveBeforeProjectAction(get, projectId, {
      title: "Сохранить схему перед автопривязкой?",
      description: "Автопривязка запишет новую версию схемы. Если не сохранить сейчас, "
        + "текущие правки потом упрутся в расхождение версий.",
      confirmLabel: "Сохранить и привязать",
    });
    if (!proceed) return null;

    try {
      const result = await requestAutobind(projectId, channelRoot);
      if (!result.ok) {
        // Тело ошибки — `{timestamp, status, error, message}`; сырой JSON в тосте
        // пользователь читает как «ничего не произошло».
        throw new Error(parseBackendErrorMessage(result.status, result.text));
      }
      const report = result.data;

      // Открытую сцену перечитываем, иначе на холсте останутся прежние теги, а ближайшее
      // сохранение затрёт автопривязку. Только для текущего проекта: `loadScene` берёт
      // проект из `currentProject`, и для чужой сцены проверка принадлежности сбросит холст.
      const openScene = get().scene;
      if (currentProject?.id === projectId && openScene
        && report.scenes.some(s => s.scene_id === Number(openScene.id))) {
        const temporal = editorStore().temporal.getState();
        temporal.pause();
        try {
          await get().loadScene(Number(openScene.id), {keepHistory: true});
        } finally {
          editorStore().temporal.getState().resume();
        }
        // Историю чистим: шаг undo вернул бы прежние теги поверх только что проставленных.
        editorStore().temporal.getState().clear();
      }

      toast.success(`Привязано свойств: ${report.bound}, изменено: ${report.changed}`);
      return report;
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Не удалось выполнить автопривязку"));
      return null;
    }
  },
  createProject: async (name: string) => {
    try {
      const result = await requestCreateProject(name);
      if (!result.ok) throw new Error(result.text);

      const newProject = toEditorProject(result.data);
      if (!newProject) {
        throw new Error("Некорректный ответ при создании проекта");
      }
      set(state => ({projectList: [...state.projectList, newProject]}));
      toast.success("Проект создан");
      return newProject;
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Ошибка создания проекта"));
    }
  },
  deleteProject: async (id: number) => {
    try {
      // Проект и сцена — один вид компонента, поэтому адрес общий.
      // Схемы проекта удаляет каскадом бэкенд.
      //
      // `based_on_version` не шлём: он проверяется по каждой затронутой СЦЕНЕ, а
      // проект каскадом уносит их все — одним номером их версии не описать.
      await deleteComponentsRequest([id]);

      set(state => ({projectList: state.projectList.filter(p => p.id !== id)}));

      // Удалили текущий проект — вместе с ним ушли и все его схемы. Сброс на стороне
      // клиента уже написан в setCurrentProject: он гасит открытую сцену, elements,
      // sceneList, буфер обмена, всё версионирование, просмотр версии и историю undo
      // (иначе Ctrl+Z воскресил бы элементы несуществующего проекта).
      if (get().currentProject?.id === id) {
        get().setCurrentProject(null);
      }

      toast.success("Проект удалён");
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Ошибка удаления проекта"));
    }
  },
  setCurrentProject: (project) => {
    // Сброс (null) память не трогает: его делают и гарды прав, а проект остаётся «последним»
    // для разделов, где он доступен.
    if (project) rememberProject(project.id);
    set(() => ({
      currentProject: project,
      // Иерархия Проект -> Схема -> Элементы: при смене/снятии проекта
      // обязаны сбросить всё, что привязано к предыдущему проекту.
      scene: null,
      elements: [],
      sceneList: [],
      selectedIds: [],
      activeGroupKey: null,
      selectedTableCell: null,
      currentComponentStateByElementKey: {},
      // Буфер держит элементы прошлого проекта — вставлять их в другой проект нельзя.
      clipboard: null,
      // Версии принадлежали сцене прошлого проекта: и база сохранения, и открытый
      // просмотр версии после смены проекта бессмысленны и опасны.
      sceneVersion: null,
      versions: [],
      versionsExhausted: false,
      saveConflict: null,
      staleBaseVersion: null,
      autosaveError: null,
    }));
    editorSession.pasteCount = 0;
    // Координата курсора и точка последней вставки принадлежали прошлой схеме.
    editorSession.lastPastePoint = null;
    editorSession.stackedPastes = 0;
    clearCanvasPointerWorld();
    discardVersionPreview();
    // История undo принадлежала прошлому проекту — иначе Ctrl+Z «воскресит» его элементы.
    editorStore().temporal.getState().clear();
  },
});
