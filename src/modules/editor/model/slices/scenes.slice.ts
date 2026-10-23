import {toast} from "sonner";
import type {EditorState} from "@/store/useEditorStore";
import type {SceneType} from "@/types/editorElement.type";
// переедут в core/scene вместе с остальным lib (шаг 8)
import {
  dropReleaseScenes, dropScene, fetchSceneWithVersion, getCachedScene, releaseVersionOf, SceneLoadError,
  type SceneSource,
} from "@/lib/editor/sceneCache";
import {fetchCurrentVersion} from "@/lib/editor/versionsApi";
import {promptModal} from "@/components/ui/ConfirmModal";
import {editorSession} from "../editorSession";
import {editorStore} from "../editorStoreRef";
import {
  applyLoadedScene, canWriteCurrentProject, deleteComponentsRequest, discardVersionPreview, getErrorMessage,
  logSceneTiming, refuseViewOnly, revalidateCachedScene, scheduleScenePrefetch,
} from "../editorStoreInternals";

/**
 * Зона «Сцены» стора редактора: открытая сцена, список сцен проекта, источник схем
 * (черновик редактора или prod-выпуск монитора) и загрузка/создание/удаление сцены.
 * Правила — docs/domain/projects-and-releases.md и scene-cache-and-versions.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6). Загрузка сцены
 * подменяет документ и версии, переключение источника прячет документ в стеш, — поэтому
 * зависимости здесь весь `EditorState`. Код перенесён без изменений.
 */
export interface ScenesSlice {
  scene: SceneType | null;
  sceneList: {id: number; name: string}[];
  /**
   * Откуда берутся схемы: `draft` — черновик (редактор), `release` — prod-выпуск (монитор).
   * Выставляет страница, а не действие: монитор открывает схемы ещё и из скриптов
   * (`openSceneFromScript`) и вкладок, и любой обходной путь без флага открыл бы черновик.
   * См. docs/contract/2026-09-29-project-release-contract.md.
   */
  sceneSource: SceneSource;
  setSceneSource: (source: SceneSource) => void;
  /** Номер выпуска, который сейчас рисует монитор (`X-Release-Version`, сессия, `TREE_CHANGED`). */
  releaseVersionNo: number | null;
  setReleaseVersionNo: (versionNo: number | null) => void;
  /** Почему монитор не может показать выпуск (проект не в эксплуатации); null — всё в порядке. */
  releaseError: string | null;
  /** prod сменился (кадр `TREE_CHANGED`): перечитать список и текущую схему выпуска. */
  reloadRelease: (versionNo: number) => Promise<void>;
  loadSceneList: (projectId: number) => Promise<{id: number; name: string}[] | void>;
  /**
   * `keepHistory` — не чистить стек undo. Нужен только для перезагрузки ТОЙ ЖЕ сцены
   * после сохранения: границу сцены/проекта мы не пересекаем, поэтому история остаётся
   * валидной. Все остальные вызовы (смена сцены/проекта) историю обязаны чистить.
   */
  loadScene: (id: number, opts?: { keepHistory?: boolean }) => Promise<void>;
  createScene: (name?: string) => Promise<{id: number; name: string} | void>;
  deleteScene: (id: number) => Promise<void>;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createScenesSlice = (set: EditorSet, get: () => EditorState): ScenesSlice => ({
  scene: null,
  sceneList: [],
  sceneSource: "draft",
  releaseVersionNo: null,
  releaseError: null,

  setReleaseVersionNo: (versionNo) => {
    if (get().releaseVersionNo !== versionNo) set({releaseVersionNo: versionNo});
  },
  setSceneSource: (source) => {
    const state = get();
    if (state.sceneSource === source) return;

    if (source === "release") {
      // Просмотр версии — тоже подмена холста; сначала вернуть живой документ, иначе в
      // стеш легла бы версия вместо правок.
      if (state.versionPreview) state.exitVersionPreview();
      const s = get();
      editorSession.draftStash = {
        projectId: s.currentProject?.id ?? null,
        scene: s.scene,
        sceneList: s.sceneList,
        elements: s.elements,
        selectedIds: s.selectedIds,
        activeGroupKey: s.activeGroupKey,
        currentComponentStateByElementKey: s.currentComponentStateByElementKey,
        isDirty: s.isDirty,
        sceneVersion: s.sceneVersion,
        savedSnapshot: editorSession.savedElementsSnapshot,
      };
      set({sceneSource: "release", releaseVersionNo: null, releaseError: null, selectedIds: []});
      // Показанная схема — черновик; в мониторе её место занимает та же схема из выпуска.
      const projectId = s.currentProject?.id;
      const sceneId = s.scene?.id;
      set({scene: null, elements: [], sceneList: []});
      if (projectId != null) {
        void get().loadSceneList(projectId).then(list => {
          if (sceneId == null || get().sceneSource !== "release") return;
          if (list?.some(x => x.id === Number(sceneId))) void get().loadScene(Number(sceneId));
        });
      }
      return;
    }

    // Возврат в редактор.
    const stash = editorSession.draftStash;
    editorSession.draftStash = null;
    const projectId = state.currentProject?.id ?? null;
    set({sceneSource: "draft", releaseVersionNo: null, releaseError: null});
    if (stash && stash.projectId === projectId) {
      set({
        scene: stash.scene,
        sceneList: stash.sceneList,
        elements: stash.elements,
        selectedIds: stash.selectedIds,
        activeGroupKey: stash.activeGroupKey,
        selectedTableCell: null,
        currentComponentStateByElementKey: stash.currentComponentStateByElementKey,
        isDirty: stash.isDirty,
        sceneVersion: stash.sceneVersion,
      });
      // Снимок «что на сервере» — тоже прежний, иначе isDirty пересчитался бы от выпуска.
      editorSession.savedElementsSnapshot = stash.savedSnapshot;
      return;
    }
    // Проект сменили в мониторе — черновик прежнего отброшен. Та схема, что открыта
    // сейчас, перечитывается из черновика: выпуск в редакторе показывать нельзя.
    const sceneId = state.scene?.id;
    set({scene: null, elements: [], sceneList: []});
    if (projectId != null) {
      void get().loadSceneList(projectId).then(list => {
        if (sceneId == null || get().sceneSource !== "draft") return;
        if (list?.some(x => x.id === Number(sceneId))) void get().loadScene(Number(sceneId));
      });
    }
  },
  reloadRelease: async (versionNo) => {
    const {currentProject, sceneSource} = get();
    if (sceneSource !== "release" || !currentProject) return;
    const projectId = currentProject.id;
    dropReleaseScenes(projectId);
    set({releaseVersionNo: versionNo});
    const list = await get().loadSceneList(projectId);
    // Пока грузили список, ушли из монитора или сменили проект — дальше не наше.
    const s = get();
    if (s.sceneSource !== "release" || s.currentProject?.id !== projectId || !list) return;
    const currentId = s.scene?.id != null ? Number(s.scene.id) : null;
    const target = currentId != null && list.some(x => x.id === currentId) ? currentId : list[0]?.id;
    if (target != null) {
      await get().loadScene(target);
    } else {
      set({scene: null, elements: []});
    }
  },
  loadSceneList: async (projectId: number) => {
    const source = get().sceneSource;
    try {
      // Монитор — схемы prod-выпуска; редактор — черновика.
      const res = await fetch(source === "release"
        ? `/api/runtime/projects/${projectId}/scenes`
        : `/api/editor/scene?project_id=${projectId}`);

      // 409 у выпуска — проект не в эксплуатации: это состояние экрана, а не сбой.
      if (source === "release" && res.status === 409) {
        if (get().sceneSource !== "release") return;
        const body = await res.json().catch(() => null) as {message?: string} | null;
        set({
          sceneList: [], scene: null, elements: [], releaseVersionNo: null,
          releaseError: body?.message || "Проект не в эксплуатации — выпуск не исполняется",
        });
        return [];
      }
      if (!res.ok) {
        throw new Error(await res.text().catch(() => "Ошибка загрузки списка сцен"));
      }

      const json = await res.json();
      // Ответ устарел: пока шёл запрос, ушли из монитора (или вернулись в него).
      if (get().sceneSource !== source) return;
      const list = Array.isArray(json) ? json : [];
      set({sceneList: list, ...(source === "release" ? {releaseError: null} : {})});
      if (source === "release") {
        const release = releaseVersionOf(res);
        if (release != null) get().setReleaseVersionNo(release);
      }
      scheduleScenePrefetch(projectId, list, source);
      return list;
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Ошибка загрузки списка сцен"));
    }
  },
  loadScene: async (id, loadOpts) => {
    // Просмотр версии переживал переключение схемы: холст новой сцены оставался
    // readOnly, а в стеше висели элементы прошлой. Границу документа режим
    // просмотра не пересекает.
    discardVersionPreview();

    // Номер вызова: ответ, пришедший после того как пользователь открыл другую
    // схему, применять нельзя — иначе на холсте окажется не та, что выбрана.
    const seq = ++editorSession.sceneLoadSeq;
    const startedAt = performance.now();

    try {
      const {currentProject} = get();
      if (!currentProject) {
        toast.error("Сначала выберите проект");
        set({scene: null, elements: [], selectedIds: [], activeGroupKey: null, selectedTableCell: null, currentComponentStateByElementKey: {}});
        return;
      }
      const projectId = currentProject.id;

      // Попадание в кэш — показываем сразу, свежесть проверяем в фоне (см.
      // lib/editor/sceneCache.ts). Перечитывание после сохранения (keepHistory) в
      // кэш не смотрит: ему нужно именно состояние сервера после записи.
      // Выпуск неизменяем: свежесть не проверяем (смену prod приносит TREE_CHANGED, и
      // тогда кэш выпуска сбрасывается целиком), номер версии сцены не нужен.
      const source = get().sceneSource;
      const isRelease = source === "release";
      const cached = loadOpts?.keepHistory ? null : getCachedScene(projectId, id, source);
      if (cached && cached.version !== undefined) {
        const applyAt = performance.now();
        if (!applyLoadedScene(cached.scene, cached.version)) return;
        logSceneTiming(id, "кэш", startedAt, applyAt);
        if (isRelease) {
          if (cached.releaseVersion != null) get().setReleaseVersionNo(cached.releaseVersion);
        } else {
          void revalidateCachedScene(projectId, id, cached.version, editorSession.documentGeneration);
        }
        return;
      }

      const {scene, version, releaseVersion} = await fetchSceneWithVersion(
        projectId, id, {fresh: loadOpts?.keepHistory, source},
      );
      if (seq !== editorSession.sceneLoadSeq || get().sceneSource !== source) return;

      const applyAt = performance.now();
      if (!applyLoadedScene(scene, version ?? null)) return;
      logSceneTiming(id, "сеть", startedAt, applyAt);
      if (isRelease) {
        if (releaseVersion != null) get().setReleaseVersionNo(releaseVersion);
        set({releaseError: null});
      } else if (version === undefined) {
        // Номер не получили — спросим ещё раз в фоне, как раньше: без него редактор
        // работает, а based_on_version подставится к моменту первого сохранения.
        void get().refreshSceneVersion();
      }

    } catch (err: unknown) {
      if (seq !== editorSession.sceneLoadSeq) return;
      console.error(err);
      // Монитор: схемы нет в выпуске (например, закреплённая вкладка на схему, которую
      // ещё не выпустили) — показанную схему не гасим, это не поломка экрана.
      if (err instanceof SceneLoadError && get().sceneSource === "release") {
        if (err.status === 404) {
          toast.error("Этой схемы нет в текущем выпуске проекта");
          return;
        }
        if (err.status === 409) {
          set({releaseError: "Проект не в эксплуатации — выпуск не исполняется", scene: null, elements: []});
          return;
        }
      }
      toast.error(getErrorMessage(err, "Ошибка загрузки сцены"));
      // Сбрасываем состояние при ошибке, чтобы не показывать данные от предыдущей сцены
      set({scene: null, elements: [], selectedIds: [], activeGroupKey: null, selectedTableCell: null, currentComponentStateByElementKey: {}});
    } finally {
      // Загрузка сцены — новая точка отсчёта: чистим историю undo, иначе Ctrl+Z
      // «воскресит» элементы прошлой сцены (с чужим parentKey и id:null → дубли на сервере).
      //
      // Исключение — перезагрузка той же сцены после сохранения (keepHistory):
      // границу сцены не пересекаем, и чистка здесь означала бы, что любое
      // сохранение (в том числе тихое автосохранение раз в 10 минут) молча
      // стирает весь стек undo/redo пользователя.
      // Устаревший вызов историю не трогает: она уже принадлежит схеме, открытой позже.
      if (!loadOpts?.keepHistory && seq === editorSession.sceneLoadSeq) {
        editorStore().temporal.getState().clear();
      }
    }
  },
  createScene: async (name?: string) => {
    try {
      const {currentProject} = get();
      if (!currentProject) {
        toast.error("Сначала выберите проект");
        return;
      }
      if (!canWriteCurrentProject()) {
        refuseViewOnly();
        return;
      }

      // Если имя не передано из UI (например, нажата кнопка «Создать сцену»
      // в ToolsPanel), спрашиваем модалкой.
      const sceneName = (name ?? await promptModal({
        title: "Новая сцена",
        label: "Название сцены",
        placeholder: "Например: Линия розлива",
        confirmLabel: "Создать",
      }))?.trim();
      if (!sceneName) return;

      const payload = {name: sceneName, project_id: currentProject.id};

      const res = await fetch("/api/editor/scene", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ошибка ${res.status}: ${text}`);
      }

      const newScene = await res.json();

      set({
        scene: newScene,
        // Новая сцена пуста: сбрасываем элементы предыдущей сцены, иначе они
        // останутся на холсте с parentKey от СТАРОЙ сцены (неверная вложенность,
        // а при сохранении окажутся отфильтрованы и потеряны).
        elements: [],
        sceneList: [...get().sceneList, {id: newScene.id, name: newScene.name}],
        selectedIds: [],
        activeGroupKey: null,
        selectedTableCell: null,
        currentComponentStateByElementKey: {},
        // У новой сцены версий ещё нет: первое сохранение уйдёт без
        // based_on_version, а история прошлой сцены к ней не относится.
        sceneVersion: null,
        versions: [],
        versionsExhausted: false,
        saveConflict: null,
        staleBaseVersion: null,
        autosaveError: null,
      });

      // Новая сцена — новая точка отсчёта для undo, и просмотр версии прошлой
      // сцены сюда не переносится (иначе холст остался бы readOnly).
      discardVersionPreview();
      editorStore().temporal.getState().clear();

      toast.success("Сцена создана");
      return {id: newScene.id, name: newScene.name};
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Ошибка создания сцены"));
    }
  },
  deleteScene: async (id: number) => {
    try {
      const {currentProject} = get();
      if (!currentProject) {
        toast.error("Сначала выберите проект");
        return;
      }
      if (!canWriteCurrentProject()) {
        refuseViewOnly();
        return;
      }

      const wasCurrent = get().scene?.id === id;

      // Версию берём у той сцены, которую удаляем: открытая знает свою из стора,
      // за чужой (её удаляют из списка схем, не открывая) идём в историю. Нет
      // версий вовсе — поле не отправляем, иначе бэкенд ответит 400.
      const basedOnVersion = wasCurrent
        ? get().sceneVersion
        : await fetchCurrentVersion("scenes", id).catch(() => null);

      await deleteComponentsRequest([id], basedOnVersion);
      dropScene(currentProject.id, id);

      set(state => ({
        sceneList: state.sceneList.filter(s => s.id !== id),
        ...(state.scene?.id === id
          ? {
              scene: null, elements: [], selectedIds: [], activeGroupKey: null,
              selectedTableCell: null, currentComponentStateByElementKey: {},
              // Версии удалённой сцены больше ни к чему не относятся.
              sceneVersion: null, versions: [], versionsExhausted: false,
              saveConflict: null, staleBaseVersion: null, autosaveError: null,
            }
          : {}),
      }));

      // Удалили сцену, которую как раз просматривали в истории: холст остался бы
      // readOnly без единого способа выйти — сцены-то больше нет.
      if (wasCurrent) discardVersionPreview();

      toast.success('Сцена удалена');
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, 'Ошибка удаления сцены'));
    }
  },
});
