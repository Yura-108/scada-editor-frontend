import {toast} from "sonner";
import type {EditorState} from "../editorStore";
import type {SaveConflict, SaveKind} from "@/types/editorVersion.types";
// переедут в core/scene вместе с остальным lib (шаг 8)
import {buildComponentTree} from "@/core/scene";
import {dropScene} from "@/core/project";
import {editorSession} from "../editorSession";
import {checkBeforeSave} from "../saveGuards";
import {applySavedTree, withSaveLock} from "../saveFlow";
import {requestSaveScene} from "../../api/saveScene";
import {
  canWriteCurrentProject,
  getErrorMessage,
  markSceneSaved,
  parseBackendErrorMessage,
  refuseViewOnly,
  reportMergedChanges,
} from "../editorStoreInternals";

/**
 * Зона «Сохранение» стора редактора: сохранение сцены (`exportScene`), признак
 * несохранённого, конфликты сохранения и ошибка автосохранения.
 * Правила — в docs/domain/scene-cache-and-versions.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6); история версий,
 * просмотр и восстановление — соседний `versions.slice`. Сохранение читает и пишет почти
 * все зоны (сцена, проект, элементы, выделение), поэтому зависимости здесь — весь
 * `EditorState`. Запрос — `api/saveScene.ts`, проверки — `model/saveGuards.ts`, замок и
 * подмена холста — `model/saveFlow.ts`.
 */
export interface SaveSlice {
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
  dismissSaveConflict: () => void;
  /** Скрыть плашку о чужой версии, замеченной автосохранением. */
  dismissStaleBaseVersion: () => void;
  /** Пересохранить поверх чужой версии: based_on_version = current_version из 409. */
  saveOverConflict: () => Promise<boolean>;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createSaveSlice = (set: EditorSet, get: () => EditorState): SaveSlice => ({
  isSaving: false,
  isDirty: false,
  lastSavedAt: null,
  saveConflict: null,
  staleBaseVersion: null,
  autosaveError: null,

  exportScene: async (opts) => {
    // Без права правки на сервер не пишем: автосейв просто пропускает тик.
    if (!canWriteCurrentProject()) return opts?.silent ? false : refuseViewOnly();
    // Сериализуем все сохранения через общий замок (см. `saveInFlight`),
    // иначе два параллельных POST с id=null создадут дубли на сервере.
    // Автосейв не встаёт в очередь — просто пропускает тик (поймает
    // изменения на следующем).
    if (opts?.silent && editorSession.saveInFlight) return false;
    // Ручное сохранение дожидается текущего сейва, чтобы затем сохранить
    // уже актуальное (и id-сверенное после reload) состояние — см. withSaveLock.
    return withSaveLock(async (): Promise<boolean> => {
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
          await applySavedTree(
            get, set, scene, currentProject?.id,
            {components: savedComponents, versionNo: savedVersion},
            opts?.keepView,
          );
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
    });
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
