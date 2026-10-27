import {toast} from "sonner";
import type {EditorState} from "../editorStore";
import {
  type VersionKind,
  type VersionListQuery,
  type VersionPreview,
  type VersionSummary,
} from "@/types/editorVersion.types";
// переедут в core/scene вместе с остальным lib (шаг 8)
import {dropScene} from "@/lib/editor/sceneCache";
import {
  fetchCurrentVersion,
  fetchVersionAt,
  fetchVersionContent,
  fetchVersions,
  restoreVersionRequest,
} from "@/lib/editor/versionsApi";
import {editorSession} from "../editorSession";
import {editorStore} from "../editorStoreRef";
import {replaceCanvasFromServer, withSaveLock} from "../saveFlow";
import {findPreviousManualVersion, reportRestoreOutcome} from "../versionHistory";
import {
  canWriteCurrentProject,
  enterVersionPreview,
  getErrorMessage,
  markSceneSaved,
  refuseViewOnly,
  VERSIONS_PAGE_SIZE,
} from "../editorStoreInternals";

/**
 * Зона «Версии» стора редактора: номер версии сцены, история версий, просмотр и
 * восстановление версии. Сохранение и конфликты — соседний `save.slice`.
 * Правила — в docs/domain/scene-cache-and-versions.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6). Его экшены читают и
 * пишут почти все зоны (сцена, проект, элементы, выделение), поэтому зависимости здесь — весь
 * `EditorState`, а не узкий срез, как у камеры и выделения.
 */
export interface VersionsSlice {
  // ── Версии документа (контракт от 11.08.2026) ─────────────────────────────────
  /** Версия сцены, на которой основаны текущие правки → уезжает в `based_on_version`.
   *  null — версий ещё нет (первое сохранение), поле не отправляем. */
  sceneVersion: number | null;
  /** Загруженный кусок истории версий (свежие первыми) для панели «История версий». */
  versions: VersionSummary[];
  isVersionsLoading: boolean;
  /** Больше строк в истории нет — «Показать ещё» прячется. */
  versionsExhausted: boolean;
  /**
   * Последний применённый фильтр по виду версий (то, что выбрано в панели истории).
   *
   * Обновления списка «вдогонку» (после сохранения и после восстановления) приходят
   * из стора, а не из панели, и без запомненного фильтра уходили без `kind` — то есть
   * молча подменяли отфильтрованный список полным: панель с выключенной галочкой
   * «показывать автосохранения и восстановления» начинала показывать именно их.
   */
  versionsKinds: VersionKind[] | null;
  /** Режим просмотра старой версии: холст только для чтения, правки спрятаны. */
  versionPreview: VersionPreview | null;

  refreshSceneVersion: () => Promise<void>;
  loadVersions: (opts?: VersionListQuery & {append?: boolean}) => Promise<void>;
  /** Открывает версию в режиме просмотра (не трогая несохранённые правки). */
  previewVersion: (versionNo: number) => Promise<void>;
  /** Просмотр состояния на момент времени (ISO date-time). */
  previewVersionAt: (time: string) => Promise<void>;
  exitVersionPreview: () => void;
  restoreVersion: (versionNo: number) => Promise<boolean>;
  /** «Вернуться к предыдущему сохранению»: ближайшая MANUAL старше того, что на холсте
   *  (для RESTORE — старше версии-источника, иначе шаг назад ходил бы по кругу). */
  restorePreviousManualVersion: () => Promise<boolean>;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createVersionsSlice = (set: EditorSet, get: () => EditorState): VersionsSlice => ({
  sceneVersion: null,
  versions: [],
  isVersionsLoading: false,
  versionsExhausted: false,
  versionsKinds: null,
  versionPreview: null,

  refreshSceneVersion: async () => {
    const sceneId = get().scene?.id;
    if (sceneId == null) return;

    try {
      const version = await fetchCurrentVersion("scenes", Number(sceneId));
      // Сцену могли переключить, пока запрос летел — чужую версию не подставляем.
      if (get().scene?.id !== sceneId) return;
      set({sceneVersion: version});
    } catch (err) {
      // Молча: без версии редактор работает, а ругаться тостом на фоновый запрос,
      // которого пользователь не делал, нельзя. Первое сохранение просто уйдёт
      // без based_on_version, и бэкенд ответит 400 с внятной причиной.
      console.warn("[versions] не удалось узнать текущую версию сцены:", err);
    }
  },
  loadVersions: async (opts) => {
    const sceneId = get().scene?.id;
    if (sceneId == null) return;

    const append = opts?.append ?? false;
    const limit = opts?.limit ?? VERSIONS_PAGE_SIZE;
    // Фильтр задаёт панель; обновления «вдогонку» (после сохранения, после
    // восстановления) приходят без него и обязаны повторить последний выбор
    // пользователя, а не молча показать все виды версий.
    const kinds = opts?.kinds ?? get().versionsKinds ?? undefined;

    set({isVersionsLoading: true, ...(opts?.kinds ? {versionsKinds: opts.kinds} : {})});
    try {
      const page = await fetchVersions("scenes", Number(sceneId), {...opts, kinds, limit});
      if (get().scene?.id !== sceneId) return;

      set(state => ({
        // Дозагрузка курсором по `to` включительна, поэтому последняя показанная
        // строка приходит повторно — отсеиваем по version_no, иначе она задваивается.
        versions: append
          ? [...state.versions, ...page.filter(v => !state.versions.some(x => x.version_no === v.version_no))]
          : page,
        versionsExhausted: page.length < limit,
      }));
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Не удалось загрузить историю версий"));
    } finally {
      set({isVersionsLoading: false});
    }
  },
  previewVersion: async (versionNo) => {
    const {scene} = get();
    if (!scene?.id) return;

    try {
      const doc = await fetchVersionContent("scenes", Number(scene.id), versionNo);
      const summary = get().versions.find(v => v.version_no === versionNo);

      enterVersionPreview(doc, scene, {
        versionNo,
        kind: summary?.kind ?? "MANUAL",
        userName: summary?.user_name ?? "",
        createdAt: summary?.created_at ?? "",
      });
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Не удалось открыть версию"));
    }
  },
  previewVersionAt: async (time) => {
    const {scene} = get();
    if (!scene?.id) return;

    try {
      const doc = await fetchVersionAt("scenes", Number(scene.id), time);
      if (!doc) {
        toast.info("На этот момент сохранённых версий ещё не было");
        return;
      }

      // Номер версии здесь может не прийти вовсе: `at` отдаёт документ в обычной
      // форме, а не запись истории. Подставлять 0 нельзя — плашка сказала бы
      // «версия 0», а кнопка «Восстановить» восстановила бы не то.
      const versionNo = typeof doc.version_no === "number" ? doc.version_no : null;
      const summary = versionNo != null
        ? get().versions.find(v => v.version_no === versionNo)
        : undefined;

      enterVersionPreview(doc, scene, {
        versionNo,
        kind: summary?.kind ?? "MANUAL",
        userName: summary?.user_name ?? "",
        createdAt: summary?.created_at ?? "",
        atTime: time,
      });
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Не удалось загрузить состояние на момент времени"));
    }
  },
  exitVersionPreview: () => {
    const wasPreviewing = get().versionPreview !== null;

    if (!wasPreviewing || !editorSession.versionPreviewStash) {
      // Просмотр без стеша — состояние, которого быть не должно. Но выйти из него
      // обязаны ПОЛНОСТЬЮ: без resume() история осталась бы на паузе навсегда, и
      // редактор молча перестал бы писать шаги undo.
      editorSession.versionPreviewStash = null;
      set({versionPreview: null});
      if (wasPreviewing) editorStore().temporal.getState().resume();
      return;
    }

    const stash = editorSession.versionPreviewStash;
    editorSession.versionPreviewStash = null;

    set({
      versionPreview: null,
      elements: stash.elements,
      selectedIds: stash.selectedIds,
      activeGroupKey: stash.activeGroupKey,
      selectedTableCell: null,
      currentComponentStateByElementKey: stash.currentComponentStateByElementKey,
      isDirty: stash.isDirty,
    });
    // Снимок «что лежит на сервере» тоже возвращаем: без него подписчик
    // пересчитает isDirty от чужого снимка и флаг соврёт.
    editorSession.savedElementsSnapshot = stash.savedSnapshot;

    editorStore().temporal.getState().resume();
  },
  restoreVersion: async (versionNo) => {
    if (!get().scene?.id) return false;
    if (!canWriteCurrentProject()) return refuseViewOnly();

    // Восстановление берёт ТОТ ЖЕ замок, что и сохранение. Без этого летящее
    // сохранение (ручное или автосейв) ложится на сервер уже ПОСЛЕ восстановления и
    // откатывает его, а его ответ подменяет холст дореставрационным деревом — снаружи
    // это выглядит как «восстановление не сработало». Заодно замок сериализует два
    // восстановления подряд: побеждает нажатое последним, а не ответившее последним.
    return withSaveLock(async (): Promise<boolean> => {
      const {scene} = get();
      if (!scene?.id) return false;

      try {
        // Пустой ответ на непустой сцене — признак беды (см. ниже), поэтому надо
        // знать, было ли на холсте хоть что-то ДО восстановления.
        const hadElements = get().elements.length > 0;

        const restored = await restoreVersionRequest("scenes", Number(scene.id), versionNo);

        // Восстановление дописывает историю новой версией — просмотр закрываем без
        // возврата отложенных правок: они относятся к состоянию, которое пользователь
        // только что осознанно заменил.
        editorSession.versionPreviewStash = null;
        if (get().versionPreview) editorStore().temporal.getState().resume();
        set({versionPreview: null});

        // Ответу доверяем холст только когда он подтверждён контрактом и не пуст:
        //  - без `version_no` бэкенд ответил не по контракту, и форму дерева в ответе
        //    никто не гарантировал;
        //  - ноль корневых компонентов при непустой сцене означает, что документ
        //    пришёл в форме, которую `rootComponentsOf` не разобрал. Применить такой
        //    ответ значит стереть схему и тут же пометить пустоту сохранённой —
        //    ближайший автосейв запишет её на сервер.
        // В обоих случаях честнее перечитать документ с сервера.
        const trustResponse =
          restored.version_no != null && (restored.components.length > 0 || !hadElements);

        // Восстановление записало новую версию — запись кэша сцен устарела.
        const projectId = get().currentProject?.id;
        if (projectId != null) dropScene(projectId, scene.id);

        await replaceCanvasFromServer(
          get, scene, projectId,
          trustResponse && restored.version_no != null
            ? {components: restored.components, version: restored.version_no}
            : null,
        );

        // Стек undo помнит элементы ДО восстановления, часть из которых на сервере
        // уже не существует — оставлять его значит дать Ctrl+Z воскресить их.
        editorStore().temporal.getState().clear();

        if (trustResponse) {
          set({sceneVersion: restored.version_no, saveConflict: null, staleBaseVersion: null, autosaveError: null});
          markSceneSaved(true);
        } else {
          // loadScene уже расставил elements/снимок и сам спросил текущую версию.
          set({saveConflict: null, staleBaseVersion: null, autosaveError: null});
        }
        void get().loadVersions();

        reportRestoreOutcome(versionNo, restored.restored_from, trustResponse);
        return true;
      } catch (err) {
        console.error(err);
        toast.error(getErrorMessage(err, "Не удалось восстановить версию"));
        return false;
      }
    });
  },
  restorePreviousManualVersion: async () => {
    const sceneId = get().scene?.id;
    if (sceneId == null) return false;
    if (!canWriteCurrentProject()) return refuseViewOnly();

    try {
      // Все виды, а не только MANUAL — см. findPreviousManualVersion.
      const all = await fetchVersions("scenes", Number(sceneId), {limit: VERSIONS_PAGE_SIZE});
      const previous = findPreviousManualVersion(all, get().sceneVersion);

      if (!previous) {
        toast.info("Предыдущего ручного сохранения нет");
        return false;
      }

      return await get().restoreVersion(previous.version_no);
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Не удалось найти предыдущее сохранение"));
      return false;
    }
  },
});
