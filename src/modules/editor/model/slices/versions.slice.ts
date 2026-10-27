import {toast} from "sonner";
import type {EditorState} from "../editorStore";
import {
  type SaveConflict,
  type SaveKind,
  type VersionKind,
  type VersionListQuery,
  type VersionPreview,
  type VersionSummary,
} from "@/types/editorVersion.types";
// переедут в core/scene вместе с остальным lib (шаг 8)
import {buildComponentTree} from "@/lib/buildComponentTree";
import {dropScene, putScene} from "@/lib/editor/sceneCache";
import {
  fetchCurrentVersion,
  fetchVersionAt,
  fetchVersionContent,
  fetchVersions,
  restoreVersionRequest,
} from "@/lib/editor/versionsApi";
import {editorSession} from "../editorSession";
import {editorStore} from "../editorStoreRef";
import {resolvePendingPropertyRefs} from "../propertyRefs";
import {checkBeforeSave} from "../saveGuards";
import {requestSaveScene} from "../../api/saveScene";
import {findPreviousManualVersion, reportRestoreOutcome} from "../versionHistory";
import {
  applyServerComponents,
  canWriteCurrentProject,
  enterVersionPreview,
  getErrorMessage,
  markSceneSaved,
  parseBackendErrorMessage,
  rebaseHistoryIds,
  refuseViewOnly,
  reportMergedChanges,
  VERSIONS_PAGE_SIZE,
} from "../editorStoreInternals";

/**
 * Зона «Сохранение и версии» стора редактора: сохранение сцены (`exportScene`), признак
 * несохранённого, история версий, просмотр и восстановление версии, конфликты сохранения.
 * Правила — в docs/domain/scene-cache-and-versions.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6). Его экшены читают и
 * пишут почти все зоны (сцена, проект, элементы, выделение), поэтому зависимости здесь — весь
 * `EditorState`, а не узкий срез, как у камеры и выделения. Код перенесён без изменений.
 */
export interface VersionsSlice {
  /**
   * `kind` задаётся ЯВНО, а не выводится из `silent`: `silent` значит «без тоста», и
   * связывать с ним семантику журнала версий нельзя — автосохранения не должны попадать
   * в «отменить последнее действие», и это решение вызывающего, а не наличия тоста.
   * `basedOnVersion` передаёт диалог конфликта, чтобы пересохранить поверх чужой версии.
   */
  exportScene: (opts?: {
    silent?: boolean;
    keepView?: boolean;
    kind?: SaveKind;
    basedOnVersion?: number;
  }) => Promise<boolean>;
  /** Идёт сохранение сцены (ручное или авто) — кнопка «Сохранить» показывает спиннер. */
  isSaving: boolean;
  /** Есть несохранённые изменения схемы (сравнение со снимком последнего сейва). */
  isDirty: boolean;
  /** Время последнего успешного сохранения (Date.now()), null — ещё не сохраняли. */
  lastSavedAt: number | null;

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
  /** Ответ 409: сцену успел сохранить кто-то ещё. Открывает диалог сравнения. */
  saveConflict: SaveConflict | null;
  /**
   * Версия, до которой сцена уехала у кого-то другого, пока мы работали, — узнаётся из
   * 409 на АВТОСОХРАНЕНИИ. `null` — расхождения не замечено.
   *
   * Отдельно от `saveConflict` потому, что слияние сервер делает только для ручного
   * сохранения: автосейв при расхождении отвергается всегда, и в многопользовательской
   * сцене это штатное событие раз в десять минут. Модальный диалог здесь был бы
   * издевательством — человек его не просил, а работу он прерывает. Показываем плашкой,
   * а разбираться будет ручное сохранение, у которого есть слияние.
   */
  staleBaseVersion: number | null;
  /**
   * Почему не прошло последнее АВТОСОХРАНЕНИЕ (текст бэкенда), `null` — прошло или не
   * запускалось. Нужен, чтобы ошибка, которая повторяется каждый такт (синтаксис скрипта,
   * контракт 25.09.2026), показывалась тостом один раз, а дальше висела плашкой.
   */
  autosaveError: string | null;
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
  dismissSaveConflict: () => void;
  /** Скрыть плашку о чужой версии, замеченной автосохранением. */
  dismissStaleBaseVersion: () => void;
  /** Пересохранить поверх чужой версии: based_on_version = current_version из 409. */
  saveOverConflict: () => Promise<boolean>;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createVersionsSlice = (set: EditorSet, get: () => EditorState): VersionsSlice => ({
  isSaving: false,
  isDirty: false,
  lastSavedAt: null,

  sceneVersion: null,
  versions: [],
  isVersionsLoading: false,
  versionsExhausted: false,
  versionsKinds: null,
  saveConflict: null,
  staleBaseVersion: null,
  autosaveError: null,
  versionPreview: null,

  exportScene: async (opts) => {
    // Без права правки на сервер не пишем: автосейв просто пропускает тик.
    if (!canWriteCurrentProject()) return opts?.silent ? false : refuseViewOnly();
    // Сериализуем все сохранения через общий замок (см. `saveInFlight`),
    // иначе два параллельных POST с id=null создадут дубли на сервере.
    // Автосейв не встаёт в очередь — просто пропускает тик (поймает
    // изменения на следующем).
    if (opts?.silent && editorSession.saveInFlight) return false;
    // Ручное сохранение дожидается текущего сейва, чтобы затем сохранить
    // уже актуальное (и id-сверенное после reload) состояние. Между выходом
    // из цикла и присвоением замка ниже нет `await`, поэтому два вызова не
    // могут захватить его одновременно.
    while (editorSession.saveInFlight) {
      await editorSession.saveInFlight.catch(() => {});
    }

    const run = (async (): Promise<boolean> => {
      set({isSaving: true});
      try {
        const {elements, scene, currentProject, sceneVersion} = get();

        // Сцена из проекта, свойства заполнены, не просмотр версии, есть числовой id.
        const sceneId = checkBeforeSave(get(), opts?.silent);
        if (sceneId == null) return false;

        const components = buildComponentTree(elements, String(scene?.id));
        const basedOnVersion = opts?.basedOnVersion ?? sceneVersion;
        // Поколение документа НА МОМЕНТ отправки. Если к возврату ответа оно выросло,
        // холст успели заменить (восстановление версии, просмотр, перезагрузка сцены),
        // и подменять его нашим деревом уже нельзя — см. documentGeneration.
        const generationAtSend = editorSession.documentGeneration;

        // `PUT` со всем составом сцены — см. requestSaveScene.
        const result = await requestSaveScene({
          components, sceneId, kind: opts?.kind ?? "MANUAL", basedOnVersion,
        });

        // 409 — сцену успел сохранить кто-то другой. Это не ошибка сохранения:
        // правки пользователя целы, их надо показать рядом с чужими и дать решить.
        // Поэтому ни тоста, ни сброса isDirty, ни перезагрузки сцены.
        if (result.kind === "conflict") {
          const {conflict} = result;

          // Автосохранение сервер не сливает — расхождение версии для него всегда
          // безусловный отказ. Модалку в этом случае не открываем: человек её не
          // просил. Запоминаем чужую версию для плашки и НЕ трогаем sceneVersion —
          // иначе следующее ручное сохранение уехало бы с уже «подтянутой» базой и
          // затёрло чужую работу мимо слияния.
          if (opts?.silent) {
            set({staleBaseVersion: conflict.current_version ?? null});
            return false;
          }

          set({saveConflict: conflict});
          return false;
        }

        if (result.kind === "failed") {
          throw new Error(parseBackendErrorMessage(result.status, result.text));
        }

        const {components: savedComponents, versionNo: savedVersion, merged} = result;

        // На сервере теперь другой документ — прежняя запись кэша сцен устарела при
        // любом исходе ниже. Где дерево из ответа ложится на холст, оно же ляжет и в кэш.
        if (currentProject) dropScene(currentProject.id, sceneId);

        // Пока летел запрос, документ на холсте заменили целиком — почти всегда это
        // восстановление версии, начатое до того, как сохранение успело вернуться.
        // Сохранение состоялось, но описывает уже ПРОШЛОЕ состояние: подменить им
        // холст значит отменить восстановление на глазах у пользователя, а записать
        // его `version_no` в базу — уехать следующим сохранением от чужого снимка.
        // Поэтому ответ принимаем к сведению и не трогаем ни холст, ни базу; версию
        // спрашиваем у истории, там порядок событий уже разрешён.
        if (editorSession.documentGeneration !== generationAtSend) {
          set({saveConflict: null, staleBaseVersion: null, autosaveError: null});
          if (merged) reportMergedChanges(merged);
          void get().refreshSceneVersion();
          if (get().versions.length) void get().loadVersions();

          if (!opts?.silent) {
            toast.success("Сохранено", {
              description: "Схему на холсте за это время заменили — показано новое содержимое, не то, что сохранялось.",
            });
          }
          return true;
        }

        if (!opts?.silent) toast.success("Сохранено успешно!");

        // Версия из ответа — база для следующего сохранения. Берём именно её, а не
        // «спросим потом»: между сохранением и повторным запросом сцену мог сохранить
        // кто-то ещё, и база разъехалась бы с деревом, которое лежит на холсте.
        // Если version_no не пришёл (бэкенд ещё на старом контракте) — НЕ затираем
        // уже известную версию: она получена из истории и по-прежнему валидна.
        set({
          saveConflict: null,
          // Сохранение прошло — расхождение, о котором предупреждала плашка, закрыто.
          staleBaseVersion: null,
          // И причина прошлого отказа автосохранения больше не актуальна.
          autosaveError: null,
          ...(savedVersion != null ? {sceneVersion: savedVersion} : {}),
        });

        if (merged) reportMergedChanges(merged);

        if (scene?.id) {
          // Дерево из ответа заменяет elements серверным (уже с id) и сбрасывает
          // выделение/активную группу/состояния. При keepView (автосейв) снимаем их
          // до подмены и восстанавливаем по ключам после — чтобы автосейв не «дёргал»
          // пользователя. Подхватить серверные id обязательно: без них следующее
          // сохранение снова вставит дубли (вариант А).
          const prevSelected = opts?.keepView ? get().selectedIds : null;
          const prevActive = opts?.keepView ? get().activeGroupKey : null;
          const prevStates = opts?.keepView ? get().currentComponentStateByElementKey : null;

          // Сама подмена не должна становиться шагом undo: elements лишь заменяются
          // серверными. pause/resume — тот же приём, что у addTags/editProperty
          // для изменений, синхронизированных с сервером.
          const temporal = editorStore().temporal.getState();
          temporal.pause();
          try {
            if (savedVersion != null && savedComponents.length) {
              // Берём дерево ИЗ ОТВЕТА, а не перезапрашиваем сцену: повторный GET мог
              // бы вернуть более свежую версию, чем та, чей version_no мы только что
              // записали в sceneVersion, — база разъехалась бы с холстом. Заодно
              // экономится round-trip на каждом сохранении.
              //
              // Условие на version_no не косметика: это признак того, что бэкенд
              // ответил по контракту. Пришёл ответ без номера версии — форму дерева
              // в нём никто не гарантировал, доверять ему холст нельзя, и мы уходим
              // в честную перезагрузку сцены.
              applyServerComponents(savedComponents, scene);
              if (currentProject) {
                putScene(
                  currentProject.id,
                  {...(scene as unknown as Record<string, unknown>), children: savedComponents},
                  savedVersion,
                );
              }
            } else {
              await get().loadScene(scene.id, {keepHistory: true});
            }
          } finally {
            editorStore().temporal.getState().resume();
          }

          // История пережила сохранение — значит, откатиться можно и «за» точку сейва.
          // Снимки, снятые до сохранения, содержат id:null у новых элементов, и
          // следующее сохранение вставило бы их повторно (дубли на сервере).
          // Переносим присвоенные сервером id в стек по ключам.
          // Свойства только что получили серверные номера — раздаём их ссылкам,
          // которые адресовали свойство парой «ключ элемента + имя». До сохранения
          // номера не существовало, и рантайму ссылка была не видна.
          const withRefs = resolvePendingPropertyRefs(get().elements);
          if (withRefs !== get().elements) {
            const t = editorStore().temporal.getState();
            t.pause();
            set({elements: withRefs});
            t.resume();
          }

          rebaseHistoryIds(get().elements);

          if (opts?.keepView) {
            const keys = new Set(get().elements.map(el => el.key));
            set({
              selectedIds: (prevSelected ?? []).filter(k => keys.has(k)),
              activeGroupKey: prevActive && keys.has(prevActive) ? prevActive : null,
              currentComponentStateByElementKey: Object.fromEntries(
                Object.entries(prevStates ?? {}).filter(([k]) => keys.has(k)),
              ),
            });
          }
        }

        // Всё, что сейчас в elements, лежит на сервере — снимаем «грязный» флаг.
        markSceneSaved(true);

        // Отдельный refreshSceneVersion здесь не нужен: без version_no мы уходим в
        // ветку с loadScene, а он спрашивает текущую версию сам.
        // Список истории после сохранения устарел — обновим, если панель открыта.
        if (get().versions.length) void get().loadVersions();

        return true;
      } catch (err: unknown) {
        console.error(err);
        if (opts?.silent) {
          // Автосохранение повторяется каждый такт, и та же причина (синтаксическая
          // ошибка в скрипте, контракт 25.09.2026) приходила бы тостом раз в 10 минут,
          // пока скрипт не исправят. Тост — только на НОВУЮ причину, дальше висит
          // плашка AutosaveErrorBanner.
          const message = getErrorMessage(err, "Автосохранение не удалось");
          if (message !== get().autosaveError) {
            toast.error("Автосохранение не удалось", {description: message});
          }
          set({autosaveError: message});
        } else {
          // Сообщение бэкенда называет скрипт, компонент и строку — его надо успеть
          // прочитать, поэтому тост держится дольше обычного.
          toast.error(getErrorMessage(err, "Ошибка экспорта сцены"), {duration: 30_000});
        }
        return false;
      } finally {
        set({isSaving: false});
      }
    })();

    editorSession.saveInFlight = run;
    try {
      return await run;
    } finally {
      if (editorSession.saveInFlight === run) editorSession.saveInFlight = null;
    }
  },

  // ── Версии документа ─────────────────────────────────────────────────────
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
    while (editorSession.saveInFlight) {
      await editorSession.saveInFlight.catch(() => {});
    }

    const run = (async (): Promise<boolean> => {
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

        const temporal = editorStore().temporal.getState();
        temporal.pause();
        try {
          if (trustResponse) {
            applyServerComponents(restored.components, scene);
            if (projectId != null) {
              putScene(
                projectId,
                {...(scene as unknown as Record<string, unknown>), children: restored.components},
                restored.version_no,
              );
            }
          } else {
            await get().loadScene(Number(scene.id), {keepHistory: true});
          }
        } finally {
          editorStore().temporal.getState().resume();
        }

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
    })();

    editorSession.saveInFlight = run;
    try {
      return await run;
    } finally {
      if (editorSession.saveInFlight === run) editorSession.saveInFlight = null;
    }
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
  dismissSaveConflict: () => set({saveConflict: null}),
  dismissStaleBaseVersion: () => set({staleBaseVersion: null}),
  saveOverConflict: async () => {
    const conflict = get().saveConflict;
    if (!conflict) return false;

    set({saveConflict: null});
    // Пересохраняем от той версии, которую человек только что увидел в сравнении:
    // отдельного эндпоинта разрешения конфликта в контракте нет и не нужно.
    return get().exportScene({basedOnVersion: conflict.current_version ?? undefined});
  },
});
