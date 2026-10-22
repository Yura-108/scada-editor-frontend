import {snap, GRID} from "@/lib/utils";
import type {MonitorView} from "@/lib/editor/monitorView";
import {create} from "zustand/react";
import {GroupElement, ComponentState, DiagramElement, ElementType, LeafElement, SceneType} from "@/types/editorElement.type";
import {temporal} from "zundo";
import {
  elementToGroupLocal,
  GROUP_PADDING,
  layoutGroupFromBounds,
  snapshotBounds,
  unionBounds,
  resolveParentAbsolute,
  resolveParentAbsoluteIndexed,
} from "@/lib/groupLayout";
import {ElementIndex, getElementIndex} from "@/lib/editor/elementIndex";
import {shiftElementPositions} from "@/lib/editor/shiftPositions";
import {getAbsoluteRenderedPos} from "@/lib/editor/getAbsoluteRenderedPos";
import {zIndexOf} from "@/lib/editor/zOrder";
import {isBoundsContributor} from "@/lib/editor/boundsContributor";
import {
  isMetaElement, isSameSheet, readSheetFromRaw, resolveSheet, SHEET_MAX, SHEET_MIN,
} from "@/lib/editor/sheet";
import {findStateNameRefs, renameStateNameInCode, type StateNameRef} from "@/lib/editor/stateNameRefs";
import {purgePropertyRefs} from "@/lib/editor/propertyDependents";
import {
  detachServerBindingIds,
  detachServerEventIds,
  detachServerScriptIds,
  detachServerStateIds,
} from "@/lib/editor/detachServerIds";
import {instantiateTemplate} from "@/lib/editor/templateInstance";
import {buildComponentTree} from "@/lib/buildComponentTree";
import {elementRegistry} from "@/constants/propertiesPanel";
import {normalizeProperty} from "@/lib/transformElements";
import {
  dropReleaseScenes, dropScene, fetchSceneWithVersion, getCachedScene, putScene,
  releaseVersionOf, SceneLoadError, type SceneSource,
} from "@/lib/editor/sceneCache";
import {
  createRelease, NoProdReleaseError, parseRuntimeInfo, putInOperation, setProdRelease, type CreatedRelease,
} from "@/lib/editor/releasesApi";
import {toast} from "sonner";
import {PropertyCreateDto, PropertyCreateRequestDto} from "@/types/tags.types";
import {PropertyRef, TagBinding} from "@/types/binding.types";
import type {AutobindReport} from "@/types/autobind.types";
import {createUuid} from "@/shared/lib/createUuid";
import {useRuntimeOverlayStore} from "@/core/scene";
import {normalizeProjectList, toEditorProject, type EditorProject} from "@/lib/pickProjectsFromComponents";
import {elementBoundsRendered, getElementBoundsRendered} from "@/lib/getElementBounds";
import {
  adoptPropertyEditVersion, applyLoadedScene, applyServerComponents, bindEditorStore, canWriteCurrentProject,
  createCameraSlice, createSelectionSlice, deleteComponentsRequest, discardVersionPreview, editorSession,
  enterVersionPreview, getErrorMessage, hasUnsavedWork, invalidProperties, logSceneTiming, markSceneSaved,
  parseBackendErrorMessage, rebaseHistoryIds, refuseViewOnly, renamePropertyOnServer, reportMergedChanges,
  revalidateCachedScene, SCENE_EXPORT_FORMAT, sceneBelongsToCurrentProject, scheduleScenePrefetch,
  VERSIONS_PAGE_SIZE, type CameraSlice, type SceneExportFile, type SelectionSlice,
} from "@/modules/editor";
import {isConturExport, normalizeConturElements, type ConturImportStats} from "@/lib/editor/conturImport";
import {DEFAULT_CURVE_POINTS, curvePointsBounds} from "@/lib/editor/curvePoints";
import {transformSelection, type TransformOp} from "@/lib/editor/transformSelection";
import {getCanvasPointerWorld, clearCanvasPointerWorld} from "@/lib/editor/canvasPointer";
import {confirmModal, promptModal} from "@/components/ui/ConfirmModal";
import {
  fetchCurrentVersion,
  fetchVersionAt,
  fetchVersionContent,
  fetchVersions,
  restoreVersionRequest,
} from "@/lib/editor/versionsApi";
import {
  isSaveConflictBody,
  type MergeReport,
  type SaveConflict,
  type SaveKind,
  type VersionKind,
  type VersionListQuery,
  type VersionPreview,
  type VersionSummary,
} from "@/types/editorVersion.types";
import {rememberProject} from "@/lib/editor/projectMemory";

export type {EditorProject};
// Общие хелперы переехали в src/modules/editor/model/editorStoreInternals.ts; эти три читают
// и снаружи стора, поэтому прежний путь импорта сохраняется.
export {canWriteCurrentProject, hasUnsavedWork, SCENE_EXPORT_FORMAT, type SceneExportFile} from "@/modules/editor";

// Стор режется на слайсы по зонам (docs/architecture.md, шаг 6); поля слайса описаны в его файле.
export type EditorState = CameraSlice & SelectionSlice & {
  scene: SceneType | null;
  sceneList: {id: number; name: string}[];
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
  elements: DiagramElement[];
  currentComponentStateByElementKey: Record<string, string>;
  setCurrentComponentStateId: (elementKey: string, componentState: string) => void;
  clearCurrentComponentStateId: (elementKey: string) => void;

  /**
   * Применяет батч рантайм-изменений: переключения состояний (по ИМЕНИ, с каскадом
   * на поддерево) — здесь, патчи визуальных свойств и набор «нет данных» — в
   * `useRuntimeOverlayStore` (core/scene). Оба set() идут подряд синхронно, React
   * сводит их в одну перерисовку. Без фактических изменений set() не вызывается.
   */
  applyRuntimeBatch: (batch: {
    stateNameByKey?: Record<string, string>;
    propsByKey?: Record<string, Record<string, unknown>>;
    noDataKeys?: Set<string>;
  }) => void;
  /** Сброс всех рантайм-карт (выход из монитора). */
  clearRuntime: () => void;
  clipboard: DiagramElement[] | null;
  /** Размер листа сцены. Читается из elements (`resolveSheet`), тут только запись. */
  setSheet: (w: number, h: number) => void;
  connecting: {
    fromNode: string;
    fromPort: string;
    mouseX: number;
    mouseY: number;
  } | null;

  /**
   * Зафиксировать вид сцены для монитора (замок в панели зума редактора) или снять его
   * (`null`). Это данные сцены, а не состояние просмотра: вид пишется в служебный элемент
   * рядом с размером листа, попадает в undo, помечает сцену несохранённой и уезжает на
   * сервер с сохранением. См. lib/editor/monitorView.ts.
   */
  setMonitorView: (view: MonitorView | null) => void;

  /** Сдвиг всех верхнеуровневых выделенных на dx/dy (стрелки, мульти-drag). excludeKey — уже сдвинут сам. */
  moveSelectedBy: (dx: number, dy: number, excludeKey?: string) => void;
  /** Дубликат выделения со смещением (Ctrl+D); клоны попадают в корень сцены, как при вставке. */
  duplicateSelected: () => void;
  bringToFront: (key: string) => void;
  sendToBack: (key: string) => void;
  /** Выравнивание верхнеуровневых выделенных (≥2) по краю/центру общей рамки. */
  /**
   * Поворот на 90° и отражение выделения (в т.ч. групп) — пересчётом геометрии.
   * Подробности и причина, почему не полем `rotate`, — в transformSelection.ts.
   */
  transformSelected: (op: TransformOp) => void;
  alignSelected: (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;
  /** Распределение верхнеуровневых выделенных (≥3) с равными зазорами по оси. */
  distributeSelected: (axis: 'h' | 'v') => void;

  updateElement: (id: string, data: Partial<DiagramElement>) => void;
  updateElementVisual: (id: string, data: Partial<DiagramElement>) => void;
  /** Мульти-версия updateElementVisual: один шаг undo для всех ключей. */
  updateElementsVisual: (keys: string[], data: Partial<DiagramElement>) => void;
  addComponentStateToSubtree: (elementKey: string, stateName: string) => string | null;
  removeComponentStateFromSubtree: (elementKey: string, stateName: string) => void;
  /**
   * Переименование состояния каскадом по поддереву. `rewriteCode` — заодно переписать
   * литералы `setState("старое")` в биндингах и обработчиках событий поддерева.
   */
  renameComponentStateInSubtree: (
    elementKey: string,
    oldName: string,
    newName: string,
    opts?: {rewriteCode?: boolean},
  ) => void;
  /** Read-only: где в коде поддерева упомянуто имя состояния (для диалога переименования). */
  findStateUsages: (elementKey: string, stateName: string) => StateNameRef[];
  addElementAt: (x: number, y: number, type: ElementType, extraProps?: Record<string, unknown>) => void;
  /** Заводит свойство локально; уедет со сценой. false — имя занято. */
  addProperty: (elementKey: string, payload: PropertyCreateRequestDto) => boolean;
  /** Правит свойство локально. Переименование заведённого дополнительно уходит точечным
   *  PUT — только он переносит значения наборов на новое имя. false — отказ. */
  editProperty: (
    elementKey: string,
    target: PropertyCreateDto,
    payload: PropertyCreateRequestDto,
  ) => Promise<boolean>;
  /** Удаляет свойство локально + убирает ссылки на него по сцене. */
  deleteProperty: (elementKey: string, target: PropertyCreateDto) => void;
  /** CRUD биндингов (JS-скрипты монитора) — design-time правки, попадают в undo. */
  addBinding: (elementKey: string, binding: TagBinding) => void;
  updateBinding: (elementKey: string, bindingId: string, patch: Partial<Omit<TagBinding, "v" | "id">>) => void;
  removeBinding: (elementKey: string, bindingId: string) => void;
  addTemplate: (screenX: number, screenY: number, template: DiagramElement[]) => void;
  /**
   * Кладёт готовые элементы на холст ОДНИМ действием — один шаг undo на весь импорт.
   *
   * Отдельно от `importElementsFromJson`: тот назначает ключи заново, но `propertyRefs`
   * внутри биндингов не перекладывает, и у готовых копий ссылки на соседей протухли бы.
   */
  addImportedElements: (elements: DiagramElement[], mode: "append" | "replace") => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
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
  /**
   * Импорт элементов из JSON. Выгрузка CONTUR распознаётся и переводится автоматически
   * (см. `src/lib/editor/conturImport.ts`); всё прочее импортируется как раньше.
   *
   * `mode: "replace"` кладёт на холст только импортированное — иначе повторный импорт того
   * же листа удвоит схему. Возвращает разбивку по типам для выгрузки CONTUR либо `null`.
   */
  /**
   * Сцена как переносимый JSON-файл: конверт с плоским массивом элементов в том же
   * формате, который принимает импорт (см. docs/contur/IMPORT_SCHEME_SPEC.md).
   */
  buildSceneExport: () => SceneExportFile;
  importElementsFromJson: (
    rawElements: Record<string, unknown>[],
    /** `native` — файл нашего экспорта: нормализатор чужого диалекта не запускается. */
    opts?: {mode?: "append" | "replace"; native?: boolean},
  ) => ConturImportStats | null;
  /**
   * `keepHistory` — не чистить стек undo. Нужен только для перезагрузки ТОЙ ЖЕ сцены
   * после сохранения: границу сцены/проекта мы не пересекаем, поэтому история остаётся
   * валидной. Все остальные вызовы (смена сцены/проекта) историю обязаны чистить.
   */
  loadScene: (id: number, opts?: { keepHistory?: boolean }) => Promise<void>;
  createScene: (name?: string) => Promise<{id: number; name: string} | void>;
  deleteScene: (id: number) => Promise<void>;

  groupSelected: () => void;
  /** Асинхронный: разбитые группы удаляются и на сервере (иначе вернутся после сейва). */
  ungroupSelected: () => Promise<void>;
  createComponentFromGroup: (groupKey: string, name?: string) => void;
  disassembleComponent: (componentKey: string) => void;
  moveElementToGroup: (elementKey: string, targetGroupKey: string) => void;

  // removeElements: (ids: string[]) => void;
}

const isGroup = (el: DiagramElement) => el.type === "group";

/**
 * Совпадают ли значения свойства элемента. Массивы (`points`, `dash`) сравниваем
 * поэлементно: новый массив с теми же числами — не изменение.
 */
const isSameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  return false;
};

/**
 * Меняет ли патч хоть что-то в целевом объекте (базовые поля элемента или
 * overrides его состояния). Нужен, чтобы холостая запись не создавала новый
 * массив `elements`: по ссылке на него завязаны и история undo (`equality`
 * zundo), и флаг «есть несохранённые изменения», и ре-рендер холста.
 */
const isPatchEffective = (
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean => Object.entries(patch).some(([k, v]) => !isSameValue(target[k], v));

/**
 * Ключи, которые всегда живут в БАЗЕ элемента, а не в overrides состояния.
 *
 * `zIndex` — порядок слоя, свойство самого элемента, а не его вида в конкретном
 * состоянии: сортировка выполняется там, где активного состояния не видно (корни
 * в Canvas, состав контейнера в GroupNode). Держать слой в overrides значило бы
 * ещё и завязать порядок отрисовки на переключение состояний.
 *
 * `monitorMenu` — ширина, шрифт и высота пунктов контекстного меню в мониторе:
 * настройка компонента, а не его вида, и меню одинаково в любом состоянии.
 *
 * `trend` — окно, шаг и оформление перьев тренда: та же настройка элемента.
 */
const BASE_ONLY_KEYS = new Set(["zIndex", "monitorMenu", "trend"]);

/** Делит патч на часть «в базу» и часть «в overrides состояния». */
const splitBaseOnly = (
  patch: Record<string, unknown>,
): { base: Record<string, unknown>; state: Record<string, unknown> } => {
  const base: Record<string, unknown> = {};
  const state: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    (BASE_ONLY_KEYS.has(k) ? base : state)[k] = v;
  }
  return {base, state};
};

/**
 * Верхнеуровневые выделенные: без выделенного предка (элемент с выделенным
 * предком едет вместе с ним, отдельный сдвиг задвоил бы перемещение).
 */
const topLevelSelectedKeys = (selectedIds: string[], elements: DiagramElement[]): string[] => {
  const {byKey} = getElementIndex(elements);
  const selectedSet = new Set(selectedIds);
  const hasSelectedAncestor = (el: DiagramElement): boolean => {
    let pk = el.parentKey;
    while (pk) {
      if (selectedSet.has(pk)) return true;
      pk = byKey[pk]?.parentKey ?? null;
    }
    return false;
  };
  return selectedIds.filter(k => {
    const el = byKey[k];
    return !!el && !hasSelectedAncestor(el);
  });
};

/** Применяет индивидуальные сдвиги к элементам и пересчитывает рамки их предков. */
const applyShifts = (
  elements: DiagramElement[],
  shifts: Map<string, {dx: number; dy: number}>,
  sceneId: number | null | undefined,
): DiagramElement[] => {
  const next = elements.map(el => {
    const s = shifts.get(el.key);
    return s && (s.dx || s.dy) ? shiftElementPositions(el, s.dx, s.dy) : el;
  });
  // Один пересчёт на весь набор: раньше здесь был цикл с полным проходом по
  // массиву на каждый сдвинутый ключ.
  return recomputeAncestorBounds(next, shifts.keys(), sceneId);
};

/**
 * Проставляет номера свойств тем ссылкам, что их ждали.
 *
 * Ссылка на свойство соседа адресует его парой «`componentKey` + `propertyName`», а
 * маршрутизирует рантайм по `propertyId`. Номера у свойства нет, пока сцена не сохранена
 * (свойства заводятся вместе с ней), и ссылка, созданная до первого сохранения, приходит
 * без него. Здесь она его и получает — из дерева, вернувшегося в ответе сохранения.
 *
 * Ссылка без номера появляется и у экземпляра шаблона: `addTemplate` снимает чужие
 * номера, оставляя ту же пару.
 */
const resolvePendingPropertyRefs = (elements: DiagramElement[]): DiagramElement[] => {
  const {byKey} = getElementIndex(elements);

  const idOf = (componentKey: string, propertyName: string): number | undefined =>
    (byKey[componentKey]?.properties ?? [])
      .find(p => p.name === propertyName && typeof p.id === "number")?.id;

  const fill = <T extends {propertyRefs?: PropertyRef[]}>(owner: T): T => {
    const refs = owner.propertyRefs;
    if (!refs?.length) return owner;
    let changed = false;
    const next = refs.map(ref => {
      if (ref.propertyId != null) return ref;
      const id = idOf(ref.componentKey, ref.propertyName);
      if (id == null) return ref;
      changed = true;
      return {...ref, propertyId: id};
    });
    return changed ? {...owner, propertyRefs: next} : owner;
  };

  let touched = false;
  const next = elements.map(el => {
    let changed = false;
    const bindings = (el.bindings ?? []).map(b => {
      const filled = fill(b);
      if (filled !== b) changed = true;
      return filled;
    });
    const events = (el.events ?? []).map(e => {
      if (!e.handler) return e;
      const filled = fill(e.handler);
      if (filled === e.handler) return e;
      changed = true;
      return {...e, handler: filled};
    });
    if (!changed) return el;
    touched = true;
    return {...el, bindings, ...(el.events ? {events} : {})} as DiagramElement;
  });

  // Ссылку на массив сохраняем, если ничего не изменилось: по ней завязаны equality
  // истории undo и флаг несохранённых правок.
  return touched ? next : elements;
};

/**
 * Клонирует набор элементов (с потомками) с ремапом ключей и смещением корней
 * вправо-вниз. Корни клона реparent'ятся в корень сцены. Общая база для
 * вставки (Ctrl+V) и дублирования (Ctrl+D).
 */
const cloneElementsWithOffset = (
  source: DiagramElement[],
  scene: SceneType | null,
  /** Смещение корней. Вектор, а не одно число: вставка «под курсор» двигает набор
   *  по X и Y на разную величину. */
  offset: {dx: number; dy: number} = {dx: 60, dy: 60},
): {newElements: DiagramElement[]; newRootKeys: string[]} => {
  // Новые уникальные ключи для каждого элемента набора
  const keyMap: Record<string, string> = {};
  source.forEach(el => { keyMap[el.key] = createUuid(); });

  // "Корневые" элементы — те, чей родитель не входит в набор
  const sourceKeys = new Set(source.map(el => el.key));

  const newElements = source.map(el => {
    const isRoot = !sourceKeys.has(el.parentKey ?? '');
    const remapped = {
      ...el,
      id: null,
      key: keyMap[el.key],
      parentKey: isRoot
        ? String(scene?.id ?? '')
        : (keyMap[el.parentKey!] ?? el.parentKey),
      parentId: isRoot ? (scene?.id ?? null) : null,
      children: (el.children ?? []).map(childKey => keyMap[childKey] ?? childKey),
      composition: (el.composition ?? []).map(k => keyMap[k] ?? k),
      // Скриптам выдаём новые локальные uuid (они же React-ключи), чтобы копия
      // не делила идентификаторы с оригиналом; серверные id снимаются со всех
      // вложенных сущностей — см. detachServer*Ids.
      // ЗАМЕЧАНИЕ: `properties` копируются вместе с серверными id — у
      // PropertyCreateDto поле id обязательное (number), обнуление требует
      // правки контракта свойств и сюда не входит.
      scripts: detachServerScriptIds(el.scripts),
      bindings: detachServerBindingIds(el.bindings),
      ...(el.events ? {events: detachServerEventIds(el.events)} : {}),
      states: detachServerStateIds(el.states),
    } as DiagramElement;

    // Смещаем только корневые (дочерние двигаются вместе с родителем);
    // сдвигаются все позиционные поля — см. shiftElementPositions.
    if (!isRoot) return remapped;

    return shiftElementPositions(remapped, offset.dx, offset.dy);
  });

  const newRootKeys = newElements
    .filter(el => el.parentKey === String(scene?.id ?? ''))
    .map(el => el.key);

  return {newElements, newRootKeys};
};

const isComplex = (el: DiagramElement) =>
  elementRegistry[el.type as ElementType]?.complex ?? false;

/** Логический компонент: промоутнутая группа или сложный элемент (button/custom). Участвует в children. */
const isComponentEl = (el: DiagramElement) => el.isComponent === true || isComplex(el);

/** Листовой примитив-рисунок (line/circle/rect/polygon/text/...). При промоуте уходит в composition. */
const isLeafPrimitive = (el: DiagramElement) => !isComplex(el) && el.type !== "group";

/**
 * `layoutGroupFromBounds` кладёт ВСЕ переданные ключи в `children`. Эта функция
 * переразбивает состав контейнера по роли: примитивы → composition, компоненты → children.
 */
const resplitContainer = (
  elements: DiagramElement[],
  containerKey: string,
  memberKeys: string[],
): DiagramElement[] => {
  const {byKey} = getElementIndex(elements);
  const children: string[] = [];
  const composition: string[] = [];
  for (const k of memberKeys) {
    const m = byKey[k];
    if (!m) continue;
    if (isLeafPrimitive(m)) composition.push(k);
    else children.push(k);
  }
  return elements.map(el =>
    el.key === containerKey ? ({...el, children, composition} as DiagramElement) : el,
  );
};

/**
 * После перемещения/ресайза элемента пересчитывает x/y/w/h всех групп-предков
 * снизу вверх, чтобы рамки групп всегда облегали своё содержимое.
 * Компенсирует сдвиг origin группы в локальных координатах детей, чтобы не
 * было визуального прыжка при расширении рамки в сторону верхнего-левого угла.
 *
 * Отступ здесь ОДИН и тот же, что при создании группы (`GROUP_PADDING`, сейчас 0 —
 * рамка по контуру членов). Раньше пересчёт добавлял сверху ещё 20
 * (`RECOMPUTE_EXTRA_PADDING`): группа создавалась с одним полем, а после первого же
 * сдвига ребёнка рамка навсегда прыгала на 20 наружу с каждой стороны. Компенсация
 * сдвига origin, которую обещал тот отступ, на самом деле сделана отдельно и честно —
 * циклом встречного сдвига детей ниже.
 */

/**
 * Пересчитывает рамки групп-предков после перемещения элементов.
 *
 * Принимает СРАЗУ ВЕСЬ набор сдвинутых ключей. Раньше функция вызывалась по
 * одному разу на каждый ключ, и каждый вызов проходил `.map()` по всему массиву
 * на каждого предка в цепочке плюс пересобирал индекс — перенос 50 выделенных
 * элементов означал 50 полных проходов. Теперь цепочки предков объединяются,
 * обходятся снизу вверх ровно один раз, а рабочая копия массива правится по
 * индексу: трогаются только сама группа и её прямые дети.
 */
const recomputeAncestorBounds = (
  elements: DiagramElement[],
  movedKeys: Iterable<string>,
  sceneId: number | null | undefined,
): DiagramElement[] => {
  const sceneIdStr = String(sceneId ?? "");
  const totalPadding = GROUP_PADDING;

  const index = getElementIndex(elements);

  // Группы-предки всех сдвинутых элементов с глубиной вложенности: пересчитывать
  // нужно снизу вверх, иначе внешняя группа считалась бы по устаревшим детям.
  const depthByGroupKey = new Map<string, number>();
  for (const movedKey of movedKeys) {
    const chain: string[] = [];
    let parentKey = index.byKey[movedKey]?.parentKey ?? null;
    while (parentKey && parentKey !== sceneIdStr) {
      const parent = index.byKey[parentKey];
      if (!parent || parent.type !== "group") break;
      chain.push(parent.key);
      parentKey = parent.parentKey ?? null;
    }
    // chain[0] — ближайший предок; глубина = длина цепочки от него вверх.
    for (let i = 0; i < chain.length; i++) {
      const depth = chain.length - i;
      const known = depthByGroupKey.get(chain[i]);
      if (known === undefined || depth > known) depthByGroupKey.set(chain[i], depth);
    }
  }

  if (!depthByGroupKey.size) return elements;

  const orderedGroupKeys = [...depthByGroupKey.keys()]
    .sort((a, b) => depthByGroupKey.get(b)! - depthByGroupKey.get(a)!);

  // Рабочая копия: правки вносим по индексу, а не пересборкой всего массива.
  const work = elements.slice();
  const posByKey = new Map<string, number>();
  work.forEach((el, i) => posByKey.set(el.key, i));

  // Индекс над рабочей копией: `childKeysOf` не меняется (parentKey не трогаем),
  // а `byKey` обновляем при каждой замене элемента.
  const workIndex: ElementIndex = {
    byKey: {...index.byKey},
    byId: index.byId,
    childKeysOf: index.childKeysOf,
  };

  const replace = (el: DiagramElement) => {
    const pos = posByKey.get(el.key);
    if (pos === undefined) return;
    work[pos] = el;
    workIndex.byKey[el.key] = el;
  };

  let changed = false;

  for (const groupKey of orderedGroupKeys) {
    const group = workIndex.byKey[groupKey];
    if (!group || group.type !== "group") continue;

    const childKeys = [...group.children, ...(group.composition ?? [])];
    if (!childKeys.length) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const childKey of childKeys) {
      const child = workIndex.byKey[childKey];
      if (!child) continue;
      // Рамка облегает то, что ВИДНО. Скрытый элемент рендер пропускает
      // (`CanvasNode`), но `getElementBounds` про `visible` не знает вовсе — так
      // служебный элемент импорта CONTUR (`contur_meta`, visible: false, габарит 0)
      // молча растягивал рамку до начала координат.
      if (!isBoundsContributor(child, workIndex)) continue;
      const b = elementBoundsRendered(child, workIndex);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }

    // Ни одного видимого члена — облегать нечего, рамку оставляем как есть.
    if (!isFinite(minX)) continue;

    const parentAbs = resolveParentAbsoluteIndexed(group.parentKey, workIndex, sceneId);

    const newGroupX = minX - totalPadding - parentAbs.x;
    const newGroupY = minY - totalPadding - parentAbs.y;
    const newGroupW = maxX - minX + totalPadding * 2;
    const newGroupH = maxY - minY + totalPadding * 2;
    const dx = newGroupX - group.x;
    const dy = newGroupY - group.y;

    if (dx === 0 && dy === 0 && group.w === newGroupW && group.h === newGroupH) continue;
    changed = true;

    replace({
      ...group,
      x: newGroupX,
      y: newGroupY,
      w: newGroupW,
      h: newGroupH,
    } as DiagramElement);

    if (dx === 0 && dy === 0) continue;

    // Компенсируем сдвиг origin группы в локальных координатах прямых детей,
    // чтобы их абсолютная позиция на холсте не изменилась.
    for (const childKey of childKeys) {
      const el = workIndex.byKey[childKey];
      if (!el) continue;

      const leafEl = el as LeafElement;
      const adjustedStates = (el.states ?? []).map(s => ({
        ...s,
        overrides: Object.fromEntries(
          Object.entries(s.overrides ?? {}).map(([k, v]) => {
            if (typeof v !== "number") return [k, v];
            if (k === "x" || k === "x1" || k === "x2") return [k, v - dx];
            if (k === "y" || k === "y1" || k === "y2") return [k, v - dy];
            return [k, v];
          }),
        ),
      }));

      replace({
        ...el,
        x: el.x - dx,
        y: el.y - dy,
        ...(leafEl.x1 !== undefined ? {x1: leafEl.x1 - dx} : {}),
        ...(leafEl.y1 !== undefined ? {y1: leafEl.y1 - dy} : {}),
        ...(leafEl.x2 !== undefined ? {x2: leafEl.x2 - dx} : {}),
        ...(leafEl.y2 !== undefined ? {y2: leafEl.y2 - dy} : {}),
        states: adjustedStates,
      } as DiagramElement);
    }
  }

  return changed ? work : elements;
};

const getDescendantKeys = (rootKey: string, elements: DiagramElement[]) => {
  const result = new Set<string>();
  const queue = [rootKey];
  const {byKey} = getElementIndex(elements);

  while (queue.length) {
    const currentKey = queue.shift()!;
    const current = byKey[currentKey];

    if (!current) continue;

    for (const childKey of [...(current.children ?? []), ...(current.composition ?? [])]) {
      if (result.has(childKey)) continue;

      result.add(childKey);
      queue.push(childKey);
    }
  }

  result.delete(rootKey);
  return [...result];
};

/**
 * Каскад активного состояния по ИМЕНИ вниз по поддереву (children + composition).
 * Пишет в переданную карту nextMap (elementKey → stateId) и возвращает её же.
 * Общая база для ручного переключения (StateSelect) и рантайм-батча монитора.
 */
const cascadeStateByName = (
  elements: DiagramElement[],
  nextMap: Record<string, string>,
  rootKey: string,
  stateId: string,
): Record<string, string> => {
  nextMap[rootKey] = stateId;

  const root = elements.find(el => el.key === rootKey);
  if (!root) return nextMap;

  const rootStateName = root.states.find(s => s.id === stateId)?.name;
  if (!rootStateName) return nextMap;

  const {byKey} = getElementIndex(elements);
  for (const childKey of getDescendantKeys(rootKey, elements)) {
    const child = byKey[childKey];
    if (!child) continue;

    const matchedState = child.states.find(s => s.name === rootStateName);
    if (matchedState) {
      nextMap[childKey] = matchedState.id;
      continue;
    }

    const defaultState = child.states.find(s => s.isDefault) ?? child.states[0];
    nextMap[childKey] = defaultState?.id ?? stateId;
  }

  return nextMap;
};

const ensureStateByName = (element: DiagramElement, stateName: string, forcedId?: string) => {
  if (element.states.some(state => state.name === stateName)) {
    return element;
  }

  const defaultState = element.states.find(s => s.isDefault) ?? element.states[0];
  const inheritedOverrides = defaultState ? { ...defaultState.overrides } : {};

  return {
    ...element,
    states: [
      ...element.states,
      {
        id: forcedId ?? createUuid(),
        name: stateName,
        overrides: inheritedOverrides,
        isDefault: false,
      },
    ],
  } as DiagramElement;
};

/**
 * Выдаёт членам контейнера все его состояния (сопоставление по ИМЕНИ).
 *
 * Набор состояний задаёт контейнер: имя — это то, по чему `cascadeStateByName`,
 * `buildShapeDescriptor` и бэкенд связывают родителя с потомками. Примитив, попавший в
 * компонент с четырьмя состояниями, имел ровно одно («Нормальное»): на холсте он падал
 * на своё состояние по умолчанию и выглядел правильно, но панель «Состояния» показывала
 * одно против четырёх — и это читается как «в других состояниях элемента нет».
 *
 * Обратного не делаем: контейнер состояния члена НЕ перенимает. `ensureStateByName`
 * идемпотентен, так что вызов на смешанном составе только заполняет пробелы.
 */
const syncMemberStates = (
  elements: DiagramElement[],
  containerKey: string,
  memberKeys: Iterable<string>,
): DiagramElement[] => {
  const {byKey} = getElementIndex(elements);
  const container = byKey[containerKey];
  if (!container) return elements;

  const names = container.states.map(s => s.name);
  if (!names.length) return elements;

  // Состояния нужны и вложенным потомкам: состав компонента может быть многоуровневым.
  const keys = new Set<string>();
  for (const key of memberKeys) {
    keys.add(key);
    for (const descendant of getDescendantKeys(key, elements)) keys.add(descendant);
  }
  if (!keys.size) return elements;

  let changed = false;
  const next = elements.map(el => {
    if (!keys.has(el.key)) return el;
    let updated = el;
    for (const name of names) updated = ensureStateByName(updated, name);
    if (updated !== el) changed = true;
    return updated;
  });

  // Холостая правка не должна плодить новый массив: на его ссылке завязаны equality
  // истории undo и флаг несохранённых изменений.
  return changed ? next : elements;
};

export const useEditorStore = create<EditorState>()(temporal(
    (set, get) => ({
      ...createCameraSlice(set, get),
      ...createSelectionSlice(set, get),

      scene: null,
      sceneList: [],
      currentProject: null,
      projectList: [],
      projectRuntimeFlags: {},
      projectProdVersions: {},
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
      elements: [],
      currentComponentStateByElementKey: {},
      clipboard: null,
      connecting: null,
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

      setMonitorView: (view) => {
        const {scene, currentProject, versionPreview} = get();
        // Просмотр версии — только для чтения; сцена чужого проекта — не наша.
        if (versionPreview || !sceneBelongsToCurrentProject(scene, currentProject)) return;

        set(state => {
          const meta = state.elements.find(isMetaElement);
          if (meta) {
            const {monitorView: _old, ...rest} = meta as unknown as Record<string, unknown>;
            void _old;
            const next = view ? {...rest, monitorView: view} : rest;
            return {
              elements: state.elements.map(el => el.key === meta.key ? next as unknown as DiagramElement : el),
            };
          }
          if (!view) return {};

          // Служебного элемента ещё нет (лист по умолчанию) — заводим его тем же видом, что
          // и setSheet, но без блока `canvas`: лист остаётся по умолчанию.
          const created = {
            id: null,
            key: createUuid(),
            type: "meta",
            visible: false,
            monitorView: view,
            x: 0, y: 0, w: 0, h: 0,
            composition: [],
            parentId: scene?.id ?? null,
            parentKey: String(scene?.id ?? ""),
            children: [],
            label: "Лист",
            scripts: [], bindings: [], properties: [],
            states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
          } as unknown as DiagramElement;
          return {elements: [...state.elements, created]};
        });
      },

      moveSelectedBy: (dx, dy, excludeKey) => {
        if (!dx && !dy) return;
        const {selectedIds, elements, scene} = get();
        if (!selectedIds.length) return;

        const keysToMove = topLevelSelectedKeys(selectedIds, elements).filter(k => k !== excludeKey);
        if (!keysToMove.length) return;

        const shifts = new Map(keysToMove.map(k => [k, {dx, dy}] as const));
        set({elements: applyShifts(elements, shifts, scene?.id)});
      },
      transformSelected: (op) => {
        const {selectedIds, elements, scene} = get();
        if (!selectedIds.length) return;

        // Только верхнеуровневые: у элемента с выделенным предком геометрию пересчитает
        // сам предок, иначе поворот применился бы к нему дважды.
        const keys = topLevelSelectedKeys(selectedIds, elements);
        if (!keys.length) return;

        const next = transformSelection(elements, keys, op, snap);
        if (next === elements) return;

        // Одним set() — значит одним шагом undo на всю операцию.
        set({elements: recomputeAncestorBounds(next, keys, scene?.id)});
      },
      alignSelected: (mode) => {
        const {selectedIds, elements, scene} = get();
        const keys = topLevelSelectedKeys(selectedIds, elements);
        if (keys.length < 2) return;

        const {byKey} = getElementIndex(elements);
        const boundsByKey = new Map(keys.map(k => [k, getElementBoundsRendered(byKey[k], elements)] as const));
        const bs = [...boundsByKey.values()].filter(b => isFinite(b.minX));
        if (bs.length < 2) return;

        // Цель — край/центр общей рамки выделения.
        const isH = mode === 'left' || mode === 'hcenter' || mode === 'right';
        const min = Math.min(...bs.map(b => isH ? b.minX : b.minY));
        const max = Math.max(...bs.map(b => isH ? b.maxX : b.maxY));
        const target = mode === 'left' || mode === 'top' ? min
          : mode === 'right' || mode === 'bottom' ? max
          : (min + max) / 2;

        const shifts = new Map<string, {dx: number; dy: number}>();
        for (const k of keys) {
          const b = boundsByKey.get(k)!;
          if (!isFinite(b.minX)) continue;
          const cur = mode === 'left' ? b.minX
            : mode === 'right' ? b.maxX
            : mode === 'hcenter' ? (b.minX + b.maxX) / 2
            : mode === 'top' ? b.minY
            : mode === 'bottom' ? b.maxY
            : (b.minY + b.maxY) / 2;
          const d = target - cur;
          if (d) shifts.set(k, isH ? {dx: d, dy: 0} : {dx: 0, dy: d});
        }
        if (!shifts.size) return;
        set({elements: applyShifts(elements, shifts, scene?.id)});
      },
      distributeSelected: (axis) => {
        const {selectedIds, elements, scene} = get();
        const keys = topLevelSelectedKeys(selectedIds, elements);
        if (keys.length < 3) return;

        const {byKey} = getElementIndex(elements);
        const items = keys
          .map(k => ({key: k, b: getElementBoundsRendered(byKey[k], elements)}))
          .filter(it => isFinite(it.b.minX))
          .sort((a, b) => axis === 'h' ? a.b.minX - b.b.minX : a.b.minY - b.b.minY);
        if (items.length < 3) return;

        // Равные зазоры: крайние остаются на месте, промежуточные раскладываются между ними.
        const size = (b: (typeof items)[0]['b']) => axis === 'h' ? b.maxX - b.minX : b.maxY - b.minY;
        const start = axis === 'h' ? items[0].b.minX : items[0].b.minY;
        const end = axis === 'h' ? items[items.length - 1].b.maxX : items[items.length - 1].b.maxY;
        const sumSizes = items.reduce((acc, it) => acc + size(it.b), 0);
        const gap = (end - start - sumSizes) / (items.length - 1);

        const shifts = new Map<string, {dx: number; dy: number}>();
        let pos = start;
        for (const it of items) {
          const cur = axis === 'h' ? it.b.minX : it.b.minY;
          const d = pos - cur;
          if (d) shifts.set(it.key, axis === 'h' ? {dx: d, dy: 0} : {dx: 0, dy: d});
          pos += size(it.b) + gap;
        }
        if (!shifts.size) return;
        set({elements: applyShifts(elements, shifts, scene?.id)});
      },
      // Порядок отрисовки задаёт `zIndex` (в пределах контейнера — среди соседей
      // с общим parentKey), поэтому «на передний/задний план» — это просто выход
      // за текущий диапазон слоёв соседей. Перекладывать массивы больше не нужно:
      // порядок массива остался лишь тай-брейком при равных слоях.
      bringToFront: (key) => {
        const {elements} = get();
        const el = elements.find(e => e.key === key);
        if (!el) return;
        const top = elements.reduce(
          (acc, e) => (e.key !== key && String(e.parentKey) === String(el.parentKey)
            ? Math.max(acc, zIndexOf(e))
            : acc),
          0,
        );
        get().updateElementVisual(key, {zIndex: top + 1});
      },
      sendToBack: (key) => {
        const {elements} = get();
        const el = elements.find(e => e.key === key);
        if (!el) return;
        const bottom = elements.reduce(
          (acc, e) => (e.key !== key && String(e.parentKey) === String(el.parentKey)
            ? Math.min(acc, zIndexOf(e))
            : acc),
          0,
        );
        get().updateElementVisual(key, {zIndex: bottom - 1});
      },

      /**
       * Размер листа сцены.
       *
       * Пишем в блок `canvas` служебного элемента, а не в поля сцены: эндпоинта
       * обновления сцены не существует (у неё только GET, POST-создание и DELETE),
       * а служебный элемент сохраняется вместе со всеми остальными и переживает
       * round-trip. Приём не наш — так уже устроен `contur_meta` у CONTUR.
       */
      setSheet: (w, h) => {
        const {scene, currentProject} = get();
        if (!sceneBelongsToCurrentProject(scene, currentProject)) return;

        const clamp = (v: number) => Math.min(SHEET_MAX, Math.max(SHEET_MIN, snap(v)));
        const next = {w: clamp(w), h: clamp(h)};
        if (isSameSheet(resolveSheet(get().elements), next)) return;

        set(state => {
          const meta = state.elements.find(isMetaElement);

          if (meta) {
            return {
              elements: state.elements.map(el => el.key === meta.key
                ? {
                  ...el,
                  canvas: {
                    // Остальные поля блока (units/grid/scale/origin) — данные CONTUR,
                    // сохраняем как есть.
                    ...((el as unknown as Record<string, unknown>).canvas as object ?? {}),
                    width: next.w,
                    height: next.h,
                  },
                } as unknown as DiagramElement
                : el),
            };
          }

          const created = {
            id: null,
            key: createUuid(),
            type: "meta",
            visible: false,
            canvas: {width: next.w, height: next.h, units: "px", grid: GRID},
            x: 0, y: 0, w: 0, h: 0,
            composition: [],
            parentId: scene?.id ?? null,
            parentKey: String(scene?.id ?? ""),
            children: [],
            label: "Лист",
            scripts: [], bindings: [], properties: [],
            states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
          } as unknown as DiagramElement;

          return {elements: [...state.elements, created]};
        });
      },
      addComponentStateToSubtree: (elementKey, stateName) => {
        let rootStateId: string | null = null;

        set(state => {
          const root = state.elements.find(el => el.key === elementKey);
          if (!root) return {};

          const existingRootState = root.states.find(s => s.name === stateName);
          rootStateId = existingRootState?.id ?? createUuid();

          // Потомки (children + composition) есть не только у групп, но и у complex-компонентов
          // (button/custom); для листа getDescendantKeys вернёт пустой список.
          const keysToUpdate = [elementKey, ...getDescendantKeys(elementKey, state.elements)];

          return {
            elements: state.elements.map(el => keysToUpdate.includes(el.key)
              ? ensureStateByName(el, stateName, el.key === elementKey ? rootStateId ?? undefined : undefined)
              : el
            ),
          };
        });

        return rootStateId;
      },
      // Удаление состояния каскадом по имени — симметрично добавлению: убираем
      // состояние с этим именем у корня и всех потомков (children + composition).
      // Состояние по умолчанию удалить нельзя. Указатели текущего состояния,
      // смотревшие на удалённое, сбрасываются на состояние по умолчанию.
      removeComponentStateFromSubtree: (elementKey, stateName) => {
        set(state => {
          const root = state.elements.find(el => el.key === elementKey);
          if (!root) return {};

          // Нельзя удалить дефолтное состояние (и несуществующее — нечего удалять).
          const target = root.states.find(s => s.name === stateName);
          if (!target || target.isDefault) return {};

          const keysToUpdate = new Set(
            [elementKey, ...getDescendantKeys(elementKey, state.elements)]
          );

          // id удаляемых состояний по всему поддереву — чтобы сбросить указатели.
          const removedStateIds = new Set<string>();
          for (const el of state.elements) {
            if (!keysToUpdate.has(el.key)) continue;
            for (const s of el.states) {
              if (s.name === stateName && !s.isDefault) removedStateIds.add(s.id);
            }
          }

          const nextElements = state.elements.map(el => {
            if (!keysToUpdate.has(el.key)) return el;
            // Дефолтное состояние с тем же именем не трогаем (страховка).
            const filtered = el.states.filter(s => s.name !== stateName || s.isDefault);
            if (filtered.length === el.states.length) return el;

            return {...el, states: filtered} as DiagramElement;
          });

          // Сброс указателей текущего состояния на дефолт там, где смотрели на удалённое.
          const {byKey} = getElementIndex(nextElements);
          const nextCurrent = {...state.currentComponentStateByElementKey};
          let currentChanged = false;
          for (const [key, stateId] of Object.entries(nextCurrent)) {
            if (!removedStateIds.has(stateId)) continue;
            const el = byKey[key];
            const fallback = el?.states.find(s => s.isDefault)?.id ?? el?.states[0]?.id;
            if (fallback) {
              nextCurrent[key] = fallback;
            } else {
              delete nextCurrent[key];
            }
            currentChanged = true;
          }

          return {
            elements: nextElements,
            ...(currentChanged ? {currentComponentStateByElementKey: nextCurrent} : {}),
          };
        });
      },
      /**
       * Места в пользовательском коде поддерева, где упомянуто имя состояния.
       *
       * Read-only: список нужен UI ДО мутации, чтобы спросить, переписывать ли код.
       * Живёт в сторе, потому что поддерево считает модульный `getDescendantKeys`.
       */
      findStateUsages: (elementKey, stateName) => {
        const {elements} = get();
        const subtreeKeys = new Set([elementKey, ...getDescendantKeys(elementKey, elements)]);
        return findStateNameRefs(elements, subtreeKeys, stateName);
      },
      /**
       * Переименование состояния каскадом по имени — симметрично добавлению и удалению.
       *
       * Имя состояния связывает поддерево: `cascadeStateByName` и `buildShapeDescriptor`
       * сопоставляют состояния родителя и потомков именно по нему. Переименовать только у
       * корня — значит увести потомков в состояние по умолчанию и запечь при сохранении
       * визуал не того состояния.
       *
       * `serverId`, `id`, `isDefault` и `overrides` сохраняются спредом: `serverId` —
       * единственное, по чему бэкенд отличает переименование от «удалили и создали заново»
       * (§2 контракта версий). `currentComponentStateByElementKey` не трогаем — карта по
       * `id`, а `id` не меняется.
       */
      renameComponentStateInSubtree: (elementKey, oldName, newName, opts) => {
        if (oldName === newName) return;

        set(state => {
          const root = state.elements.find(el => el.key === elementKey);
          if (!root || !root.states.some(s => s.name === oldName)) return {};

          const keysToUpdate = new Set([elementKey, ...getDescendantKeys(elementKey, state.elements)]);
          let changed = false;

          const nextElements = state.elements.map(el => {
            if (!keysToUpdate.has(el.key)) return el;

            const hasState = el.states.some(s => s.name === oldName);

            // Правка кода идёт тем же set() — один шаг undo на переименование целиком.
            // Клонируем ТОЛЬКО реально изменившиеся строки и возвращаем исходный массив,
            // если не изменилось ничего: иначе элемент с посторонними биндингами считался
            // бы изменённым и пачкал бы сцену на ровном месте.
            let bindings = el.bindings;
            let events = el.events;

            if (opts?.rewriteCode) {
              if (el.bindings?.length) {
                let touched = false;
                const next = el.bindings.map(b => {
                  if (!b.code) return b;
                  const code = renameStateNameInCode(b.code, oldName, newName);
                  if (code === b.code) return b;
                  touched = true;
                  return {...b, code};
                });
                if (touched) bindings = next;
              }
              if (el.events?.length) {
                let touched = false;
                const next = el.events.map(e => {
                  const code = e.handler?.code;
                  if (!code) return e;
                  const nextCode = renameStateNameInCode(code, oldName, newName);
                  if (nextCode === code) return e;
                  touched = true;
                  return {...e, handler: {...e.handler, code: nextCode}};
                });
                if (touched) events = next;
              }
            }

            const codeChanged = bindings !== el.bindings || events !== el.events;

            if (!hasState && !codeChanged) return el;
            changed = true;

            return {
              ...el,
              ...(hasState
                ? {states: el.states.map(s => s.name === oldName ? {...s, name: newName} : s)}
                : {}),
              ...(bindings !== el.bindings ? {bindings} : {}),
              ...(events !== el.events ? {events} : {}),
            } as DiagramElement;
          });

          // Холостая правка не должна плодить новый массив: на его ссылке завязаны
          // equality истории undo и флаг несохранённых изменений.
          return changed ? {elements: nextElements} : {};
        });
      },
      // Каскад по имени состояния — для любого контейнера (группа или complex-компонент);
      // у листа потомков нет, каскад просто не сработает (см. cascadeStateByName).
      setCurrentComponentStateId: (elementKey, componentState) => set(state => ({
        currentComponentStateByElementKey: cascadeStateByName(
          state.elements,
          {...state.currentComponentStateByElementKey},
          elementKey,
          componentState,
        ),
      })),
      clearCurrentComponentStateId: (elementKey) => set(state => {
        const next = {...state.currentComponentStateByElementKey};
        delete next[elementKey];

        return {currentComponentStateByElementKey: next};
      }),
      applyRuntimeBatch: ({stateNameByKey, propsByKey, noDataKeys}) => {
        const state = get();
        const patch: Partial<EditorState> = {};

        // 1) Переключения состояний: имя → id на корне, каскад по имени на поддерево.
        if (stateNameByKey && Object.keys(stateNameByKey).length) {
          const {byKey} = getElementIndex(state.elements);
          const nextMap = {...state.currentComponentStateByElementKey};
          for (const [elementKey, stateName] of Object.entries(stateNameByKey)) {
            const el = byKey[elementKey];
            const stateId = el?.states.find(s => s.name === stateName)?.id;
            // Нет состояния с таким именем — интент биндинга не применим, пропускаем.
            if (!stateId) continue;
            cascadeStateByName(state.elements, nextMap, elementKey, stateId);
          }
          const changed = Object.keys(nextMap).some(
            k => nextMap[k] !== state.currentComponentStateByElementKey[k],
          );
          if (changed) patch.currentComponentStateByElementKey = nextMap;
        }

        // Ничего фактически не изменилось — не дёргаем ни стор, ни рендер.
        if (Object.keys(patch).length) set(patch);

        // 2) Патчи визуальных свойств и 3) набор «нет данных» (B2/B4) — в рантайм-слой,
        // elements не трогаем. Пустой патч там тоже не вызывает set().
        useRuntimeOverlayStore.getState().applyPatch({propsByKey, noDataKeys});
      },
      clearRuntime: () => {
        set({currentComponentStateByElementKey: {}});
        useRuntimeOverlayStore.getState().clear();
      },
      updateElementVisual: (key, updates) => get().updateElementsVisual([key], updates),
      // Мульти-версия: один set() (= один шаг undo) для всех ключей.
      updateElementsVisual: (keys, updates) => {
         if (!keys.length) return;
         const { currentComponentStateByElementKey, editAllStates } = get();
         const keySet = new Set(keys);

         set(state => {
           // Хотя бы один элемент реально изменился. Без этого флага холостая
           // запись (перетаскивание, вернувшееся в ту же точку; повторный выбор
           // того же цвета) создавала новый массив elements — а значит шаг undo,
           // пометку «есть несохранённые изменения» и ре-рендер всей сцены.
           let anyChanged = false;

           const updatedElements = state.elements.map(el => {
             if (!keySet.has(el.key)) return el;

             // Валидация: гарантируем минимальные размеры для групп и элементов
             const MIN_SIZE = 20;
             const validatedUpdates = {
               ...updates,
               ...(updates.w !== undefined && { w: Math.max(MIN_SIZE, updates.w) }),
               ...(updates.h !== undefined && { h: Math.max(MIN_SIZE, updates.h) }),
             };

             // Группы всегда хранят позицию в base, не в overrides.
             // recomputeAncestorBounds читает group.x (base), поэтому override
             // приводит к расхождению rendered.x vs base.x и телепортации детей.
             if (isGroup(el)) {
               if (!isPatchEffective(el as unknown as Record<string, unknown>, validatedUpdates)) return el;
               anyChanged = true;
               return { ...el, ...validatedUpdates } as DiagramElement;
             }

             const currentComponentStateId = currentComponentStateByElementKey[el.key]
               ?? el.states.find(s => s.isDefault)?.id
               ?? el.states[0]?.id;

             if (!currentComponentStateId) {
               if (!isPatchEffective(el as unknown as Record<string, unknown>, validatedUpdates)) return el;
               anyChanged = true;
               return {
                 ...el,
                 ...validatedUpdates,
               } as DiagramElement;
             }

             // Сравниваем с ФАКТИЧЕСКИМ значением (база + overrides состояния), а не
             // только с overrides: у нетронутого элемента позиция лежит в базе, и
             // сравнение с пустыми overrides считало бы любую запись изменением.
             //
             // В режиме «править все состояния» проверять одно текущее нельзя: патч,
             // совпавший с ним, но отличный от остальных, обязан примениться — иначе
             // выравнивание состояний молча не срабатывало бы.
             const effectiveOf = (st: ComponentState | undefined) => ({
               ...(el as unknown as Record<string, unknown>),
               ...(st?.overrides ?? {}),
             });
             const patchLands = editAllStates
               ? el.states.some(st => isPatchEffective(effectiveOf(st), validatedUpdates))
               : isPatchEffective(effectiveOf(el.states.find(s => s.id === currentComponentStateId)), validatedUpdates);
             if (!patchLands) return el;
             anyChanged = true;

             // Часть ключей (BASE_ONLY_KEYS, например слой zIndex) пишем в базу даже
             // у листа: они не зависят от состояния. Если состояний-специфичных
             // ключей в патче нет — states не пересобираем.
             const {base: baseUpdates, state: stateUpdates} = splitBaseOnly(validatedUpdates);

             return {
               ...el,
               ...baseUpdates,
               // editAllStates — правка ложится во ВСЕ состояния элемента: оформление,
               // одинаковое во всех состояниях, иначе пришлось бы повторять руками в каждом.
               states: Object.keys(stateUpdates).length
                 ? el.states.map(s =>
                   (editAllStates || s.id === currentComponentStateId)
                     ? {
                       ...s,
                       overrides: {
                         ...s.overrides,
                         ...stateUpdates,
                       },
                     }
                     : s
                 )
                 : el.states,
             } as DiagramElement;
           });

           if (!anyChanged) return {};

           // Если изменились поля, влияющие на габарит — пересчитываем рамки групп-предков.
           //
           // Кроме собственно позиционных сюда входят: параметры текста (его габарит меряет
           // `measureText`, а не `w/h` — укоротил подпись, и рамка осталась под старую длину),
           // `rotate` (меняется осевой bbox) и `visible` (скрытый элемент из рамки выпадает,
           // см. isBoundsContributor).
           const POSITIONAL_KEYS = new Set([
             "x", "y", "w", "h", "x1", "y1", "x2", "y2", "radius", "points",
             "text", "fontSize", "fontFamily", "bold", "autoWidth", "rotate", "visible",
           ]);
           const hasPositionalChange = Object.keys(updates).some(k => POSITIONAL_KEYS.has(k));
           if (hasPositionalChange) {
             return { elements: recomputeAncestorBounds(updatedElements, keys, state.scene?.id) };
           }

           return { elements: updatedElements };
         });
       },
      updateElement: (key, updates) => {
        set(state => ({
          elements: state.elements.map(el =>
            el.key === key
              ? { ...el, ...updates } as DiagramElement
              : el
          )
        }));
      },
      addTemplate: (screenX, screenY, template) => {
        const {scene, currentProject} = get();

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя добавить шаблон: сцена не принадлежит выбранному проекту");
          return;
        }

        // Клонирование и позиционирование живут в `instantiateTemplate`: тем же кодом
        // пользуется импорт плана устройств, которому нужны сотни экземпляров разом.
        const newElements = instantiateTemplate(template, {
          x: screenX,
          y: screenY,
          sceneId: scene?.id ?? null,
        });

        set(state => ({
          elements: [...state.elements, ...newElements],
        }));

      },
      addImportedElements: (elements, mode) => {
        const {scene, currentProject} = get();

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя импортировать: сцена не принадлежит выбранному проекту");
          return;
        }

        set(state => ({
          elements: mode === "replace" ? elements : [...state.elements, ...elements],
        }));
      },
      buildSceneExport: () => {
        const {elements, scene} = get();
        const ownKeys = new Set(elements.map(el => el.key));

        const exported = elements.map(el => {
          // Серверные id снимаем те же, что и при копировании (см. detachServer*Ids):
          // файл может уехать в другую сцену или другой проект, и чужой id там означает
          // «эта сущность переехала» — оригинал потеряет своё, а слияние выдаст конфликт.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const {id: _id, parentId: _parentId, ...rest} = el as unknown as Record<string, unknown>;

          return {
            ...rest,
            id: null,
            parentId: null,
            // Корни помечаем так, как описано в нашей же спецификации импорта: ключа
            // сцены в файле нет, и «undefined» честнее, чем id чужой сцены.
            parentKey: el.parentKey && ownKeys.has(el.parentKey) ? el.parentKey : "undefined",
            states: detachServerStateIds(el.states),
            scripts: detachServerScriptIds(el.scripts),
            bindings: detachServerBindingIds(el.bindings),
            ...(el.events ? {events: detachServerEventIds(el.events)} : {}),
          };
        });

        // Конверт, а не голый массив: по нему импорт узнаёт СВОЙ файл и не запускает
        // нормализатор CONTUR повторно. Схема, однажды пришедшая из выгрузки, хранит её
        // поля (`lua_name`, `tech_object`) — детектор диалекта сработал бы на них снова
        // и второй раз вычел радиус из координат каждого кружка.
        return {
          format: SCENE_EXPORT_FORMAT,
          version: 1,
          exported_at: new Date().toISOString(),
          scene: {name: scene?.name ?? null},
          elements: exported,
        };
      },
      importElementsFromJson: (rawElements, importOpts) => {
        const {scene, currentProject} = get();

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя импортировать: сцена не принадлежит выбранному проекту");
          return null;
        }

        // Выгрузка CONTUR приходит в своих именах полей и своей системе координат —
        // переводим ДО общей нормализации, чтобы дальше всё шло одним путём.
        // `native` — файл нашего же экспорта: поля уже в наших именах и координатах.
        const contur = !importOpts?.native && isConturExport(rawElements)
          ? normalizeConturElements(rawElements)
          : null;
        if (contur) rawElements = contur.elements;

        // База процентных координат — размер ЛИСТА, на котором чертёж нарисован:
        // процент осмыслен только относительно него, а не относительно константы.
        // Лист берём из служебного элемента файла (`meta.canvas`).
        //
        // Фолбэк намеренно 5000, а не размер листа по умолчанию: проценты шлёт
        // только прошлое поколение выгрузок CONTUR, а у него служебного элемента
        // нет вовсе. Подставить туда лист — молча растянуть все такие файлы.
        const rawSheet = readSheetFromRaw(rawElements as Record<string, unknown>[]);
        const CANVAS_W = rawSheet?.w ?? 5000;
        const CANVAS_H = rawSheet?.h ?? 5000;

        const isNullish = (v: unknown) =>
          v == null || v === "null" || v === "undefined";

        const parseBool = (v: unknown, fallback: boolean): boolean => {
          if (v === true  || v === "true")  return true;
          if (v === false || v === "false") return false;
          return fallback;
        };

        // Converts a value to a pixel coordinate.
        // If the value is a percentage string like "84.9%", multiplies by `total` (canvas width or height).
        // If the value is already a number, returns it as-is.
        const parseCoord = (v: unknown, total: number): number => {
          if (typeof v === "number") return v;
          if (typeof v === "string") {
            const trimmed = v.trim();
            if (trimmed.endsWith("%")) {
              return (parseFloat(trimmed) / 100) * total;
            }
            const n = parseFloat(trimmed);
            return isNaN(n) ? 0 : n;
          }
          return 0;
        };

        // Pass 1: assign new keys to every element, build old→new key map
        const keyMap: Record<string, string> = {};
        for (const raw of rawElements) {
          const oldKey = String(raw.key ?? "");
          const newKey = createUuid();
          if (oldKey && !isNullish(oldKey)) {
            keyMap[oldKey] = newKey;
          }
          (raw as Record<string, unknown>).__newKey = newKey;
        }

        // Pass 2: normalise each element
        const imported: DiagramElement[] = rawElements.map(raw => {
          const newKey = raw.__newKey as string;

          const oldParentKey = String(raw.parentKey ?? "");
          const isTopLevel = isNullish(raw.parentKey) || !keyMap[oldParentKey];
          const parentKey = isTopLevel
            ? String(scene?.id)
            : keyMap[oldParentKey];

          const children = Array.isArray(raw.children)
            ? (raw.children as string[]).map(ck => keyMap[ck] ?? ck)
            : [];

          const composition = Array.isArray(raw.composition)
            ? (raw.composition as string[]).map(ck => keyMap[ck] ?? ck)
            : [];

          const states = Array.isArray(raw.states)
            ? (raw.states as Record<string, unknown>[]).map(s => ({
                id: isNullish(s.id) ? createUuid() : String(s.id),
                name: String(s.name ?? "Нормальное"),
                overrides: (s.overrides as Record<string, unknown>) ?? {},
                isDefault: parseBool(s.isDefault, false),
              }))
            : [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }];

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { __newKey, ...rest } = raw as Record<string, unknown>;

          return {
            ...rest,
            id:          isNullish(raw.id) ? null : Number(raw.id),
            key:         newKey,
            parentKey,
            // parentId из чужой сцены/проекта невалиден:
            //   - верхнеуровневые элементы должны ссылаться на id текущей сцены;
            //   - дети импортируемых групп ещё не сохранены на сервере → parentId = null
            //     (группы сами сохранят своих детей на бэкенде, и id появятся при следующей загрузке).
            parentId:    isTopLevel ? (scene?.id ?? null) : null,
            composition,
            isComponent: parseBool(raw.isComponent, false),
            children,
            scripts:     Array.isArray(raw.scripts)    ? raw.scripts    : [],
            bindings:    Array.isArray(raw.bindings)   ? raw.bindings   : [],
            // Старые выгрузки несут description вместо gateway_name — см. normalizeProperty.
            properties:  Array.isArray(raw.properties) ? raw.properties.map(normalizeProperty) : [],
            states,
            // Convert percentage strings to pixel coordinates using the logical canvas size
            x:  parseCoord(raw.x,  CANVAS_W),
            y:  parseCoord(raw.y,  CANVAS_H),
            w:  parseCoord(raw.w,  CANVAS_W),
            h:  parseCoord(raw.h,  CANVAS_H),
            ...(raw.x1 !== undefined && { x1: parseCoord(raw.x1, CANVAS_W) }),
            ...(raw.y1 !== undefined && { y1: parseCoord(raw.y1, CANVAS_H) }),
            ...(raw.x2 !== undefined && { x2: parseCoord(raw.x2, CANVAS_W) }),
            ...(raw.y2 !== undefined && { y2: parseCoord(raw.y2, CANVAS_H) }),
          } as DiagramElement;
        });

        set(state => ({
          elements: importOpts?.mode === "replace" ? imported : [...state.elements, ...imported],
        }));

        return contur?.stats ?? null;
      },
      addElementAt: (screenX, screenY, type, extraProps) => {
        const {scene, currentProject} = get();
        const rect = get().canvasRect;
        if (!rect) return;

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя добавить элемент: сцена не принадлежит выбранному проекту");
          return;
        }

        const composition: string[] = [];

        const x = snap(screenX);
        const y = snap(screenY);

        /**
         * Кладёт готовый элемент в схему — в открытый контейнер, если пользователь в него
         * вошёл, иначе в корень сцены.
         *
         * Раньше все ветки писали `parentKey: scene.id` намертво, и добавить примитив в
         * компонент было нельзя вообще: приходилось класть его рядом и потом «Переместить
         * в группу». Элемент строится в МИРОВЫХ координатах, поэтому внутрь контейнера он
         * переезжает сдвигом на его абсолютную позицию (`shiftElementPositions` двигает и
         * `x/y`, и концы линии, и overrides всех состояний).
         */
        const commitNewElement = (element: DiagramElement) => {
          const {activeGroupKey, elements} = get();
          const {byKey} = getElementIndex(elements);
          const host = activeGroupKey ? byKey[activeGroupKey] : undefined;

          if (!host || !isGroup(host)) {
            set(state => ({elements: [...state.elements, element]}));
            return;
          }

          const hostAbs = getAbsoluteRenderedPos(host, byKey);
          const local = shiftElementPositions(element, -hostAbs.x, -hostAbs.y);
          const member: DiagramElement = {
            ...local,
            parentKey: host.key,
            parentId: host.id ?? null,
          };

          // Роль в контейнере — та же, что у resplitContainer: примитивы компонента
          // живут в composition, компоненты — в children.
          const toComposition = isLeafPrimitive(member) && isComponentEl(host);

          set(state => {
            let next = [
              ...state.elements.map(el => el.key !== host.key ? el : ({
                ...el,
                children: toComposition ? el.children : [...el.children, member.key],
                composition: toComposition
                  ? [...(el.composition ?? []), member.key]
                  : (el.composition ?? []),
              } as DiagramElement)),
              member,
            ];
            // Новый член сразу получает весь набор состояний контейнера.
            next = syncMemberStates(next, host.key, [member.key]);
            // Рамка контейнера обязана вырасти под новый элемент.
            return {elements: recomputeAncestorBounds(next, [member.key], scene?.id)};
          });
        };

        if (type === 'line') {
          const newElement: DiagramElement = {
            id: null,
            key: createUuid(),
            type,
            composition,
            x,
            y,
            x1: x - 40,
            x2: x + 40,
            y1: y,
            y2: y,
            w: 80,
            h: 80,
            parentId: scene?.id || null,
            parentKey: String(scene?.id) || null,
            children: [],
            label: "Element",
            bg: "transparent",
            scripts: [],
            bindings: [],
            properties: [],
            states: [{
              id: createUuid(),
              name: "Нормальное",
              overrides: {},
              isDefault: true,
            }],
          };

          commitNewElement(newElement);

          return;
        }

        if (type === 'curve') {
          // Кубическая кривая Безье: точки локальны относительно x/y (как у полигона),
          // поэтому перетаскивание меняет только x/y, а форма живёт в points.
          const points = [...DEFAULT_CURVE_POINTS];
          const bounds = curvePointsBounds(points);
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY,
            points,
            label: "",
            bg: "transparent", strokeColor: "#9ca3af", strokeWidth: 2, strokeDasharray: "",
            arrowStart: false, arrowEnd: false,
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'arc') {
          // Радиус 60 = три клетки; габарит — описанный квадрат 2r×2r, как у круга
          // (см. ArcShapeElement). Раствор 90°, начало 0° — четверть окружности
          // от «трёх часов» по часовой стрелке.
          const radius = 60;
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 2 * radius, h: 2 * radius,
            radius, innerRadius: 0, angle: 90, rotate: 0, arcClosed: false,
            label: "",
            bg: "transparent", strokeColor: "#9ca3af", strokeWidth: 2, strokeDasharray: "",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'checkbox') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 160, h: 20,
            checked: false, label: "Checkbox",
            color: "#3b82f6", strokeColor: "#3b82f6",
            bg: "transparent",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'progress_bar') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 200, h: 20,
            value: 50, label: "", orientation: "horizontal",
            color: "#3b82f6", backgroundColor: "#e5e7eb",
            textColor: "#ffffff", showPercentage: true,
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'button') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 120, h: 40,
            // label — название элемента, text — надпись на кнопке: поля независимы.
            label: "Кнопка", text: "Кнопка", color: "#3b82f6", textColor: "#ffffff", fontSize: 16,
            rx: 6, pressed: false, enabled: true, bg: "transparent",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'toggle') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 40, h: 20,
            checked: false, label: "",
            color: "#22c55e", backgroundColor: "#9ca3af", textColor: "#e5e7eb", bg: "transparent",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'slider') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 160, h: 20,
            value: 50, min: 0, max: 100,
            color: "#3b82f6", backgroundColor: "#d1d5db", bg: "transparent",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'dropdown') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 160, h: 40,
            value: "Выбор",
            backgroundColor: "#ffffff", strokeColor: "#9ca3af", textColor: "#1a1a1a", bg: "transparent",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'input') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 160, h: 40,
            value: "", placeholder: "Введите...",
            backgroundColor: "#ffffff", strokeColor: "#9ca3af", textColor: "#1a1a1a", bg: "transparent",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'image') {
          // Дроп создаёт элемент СРАЗУ (плейсхолдер), src заполняется обработчиком
          // после выбора файла в проводнике — по этому же key (extraProps.key).
          const key = typeof extraProps?.key === 'string' ? extraProps.key : createUuid();
          const src = typeof extraProps?.src === 'string' ? extraProps.src : "";
          const w = typeof extraProps?.w === 'number' ? extraProps.w : 120;
          const h = typeof extraProps?.h === 'number' ? extraProps.h : 120;
          const newElement: DiagramElement = {
            id: null, key, type, composition,
            x, y, w, h,
            src, objectFit: "contain", bg: "transparent",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            label: "Картинка",
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        if (type === 'table') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 300, h: 160,
            rows: 4, cols: 3, showHeader: true, headerText: "Таблица", alternateRow: false,
            backgroundColor: "transparent", headerColor: "transparent",
            strokeColor: "#000000", textColor: "#000000", fontSize: 12,
            alternateColor: "#f1f5f9",
            cells: {},
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          commitNewElement(newElement);
          return;
        }

        const newElement: DiagramElement = {
          id: null,
          key: createUuid(),
          type,
          composition,
          x,
          y,
          w: 80,
          h: 80,
          // У круга рендер и панель свойств читают radius, а не w/h. Без него фигура
          // рисовалась по w/2, но в панели «Радиус» стоял 0, а первая же правка радиуса
          // прыгала с 40 на введённое. Держим тройку radius/w/h согласованной с рождения.
          ...(type === "circle" ? {radius: 40} : {}),
          parentId: scene?.id || null,
          parentKey: String(scene?.id) || null,
          children: [],
          label: "Element",
          bg: "transparent",
            scripts: [],
            bindings: [],
          properties: [],
          states: [{
            id: createUuid(),
            name: "Нормальное",
            overrides: {},
            isDefault: true,
          }],
        };

        commitNewElement(newElement);
      },
      /**
       * Свойства — обычная часть сцены, а не отдельный ресурс.
       *
       * Раньше каждая правка уходила своим запросом (`/api/editor/tags`), и из-за этого
       * свойство нельзя было завести элементу, которого ещё нет на сервере: серверный
       * `component_id` появлялся только после сохранения. Теперь свойство правится
       * локально и уезжает вместе со сценой одним PUT — бэкенд принимает весь список в
       * `ComponentCreateDto.properties`, сам заводит новые и привязывает к ним биндинги
       * по `component_property_name`.
       *
       * Адресуем КЛЮЧОМ элемента, а не серверным `component_id`: у несохранённого
       * элемента тот равен null и совпал бы с любым другим несохранённым.
       *
       * Следствия: правки попадают в undo (им там и место — они локальные) и помечают
       * сцену изменённой. Сеть остаётся ровно в одном месте — переименовании.
       */
      addProperty: (elementKey, payload) => {
        const owner = get().elements.find(el => el.key === elementKey);
        if (!owner) return false;

        const name = payload.name.trim();
        // Имя — ключ сопоставления на бэкенде (сначала по id, потом по имени), поэтому
        // дубль в пределах компонента сделал бы сопоставление неоднозначным.
        if ((owner.properties ?? []).some(p => p.name.trim() === name)) {
          toast.error(`Свойство «${name}» у этого элемента уже есть`);
          return false;
        }

        set(state => ({
          elements: state.elements.map(el => el.key === elementKey
            ? {...el, properties: [...(el.properties ?? []), {...payload, name}]} as DiagramElement
            : el),
        }));
        return true;
      },
      editProperty: async (elementKey, target, payload) => {
        const owner = get().elements.find(el => el.key === elementKey);
        if (!owner) return false;

        const name = payload.name.trim();
        const isSame = (p: PropertyCreateDto) => target.id != null
          ? p.id === target.id
          : p.id == null && p.name === target.name;

        if ((owner.properties ?? []).some(p => !isSame(p) && p.name.trim() === name)) {
          toast.error(`Свойство «${name}» у этого элемента уже есть`);
          return false;
        }

        // ЕДИНСТВЕННЫЙ оставшийся сетевой вызов.
        //
        // Раньше он был нужен ради рецептов: их значения ключевались ИМЕНЕМ свойства и
        // переезжали на новое имя только этим точечным PUT. С 09.09.2026 рецепт — процедура
        // над ТЕГАМИ, о свойствах компонента он не знает вовсе, и той причины не осталось.
        // Вызов сохранён: что ещё делает `PUT /api/editor/properties/{id}` на бэкенде,
        // отсюда не видно, и убирать его надо отдельно и осознанно.
        // Без права правки переименование остаётся локальным, как и любая правка в режиме
        // просмотра: серверный PUT ответил бы 403 и не дал бы «потыкать» схему.
        if (target.id != null && target.name.trim() !== name && canWriteCurrentProject()) {
          const {currentProject, scene} = get();
          const generation = editorSession.documentGeneration;
          const renamed = await renamePropertyOnServer(target.id, {...payload, name});
          if (!renamed.ok) return false;
          // Номер версии — ДО локального применения имени (контракт scada-r9lr).
          adoptPropertyEditVersion(currentProject?.id, scene?.id, generation, renamed.versionNo);
        }

        set(state => ({
          elements: state.elements.map(el => el.key === elementKey
            ? {
              ...el,
              properties: (el.properties ?? []).map(p =>
                isSame(p) ? {...p, ...payload, name} : p),
            } as DiagramElement
            : el),
        }));
        return true;
      },
      deleteProperty: (elementKey, target) => {
        // Просмотр версии — режим только для чтения.
        if (get().versionPreview) return;

        const owner = get().elements.find(el => el.key === elementKey);
        if (!owner) return;

        set(state => {
          // У заведённого свойства могут быть ссылки по номеру: висячий
          // `component_property_id` роняет сохранение ВСЕЙ сцены 400-м, а висячий
          // propertyRef тихо ломает логику (см. lib/editor/propertyDependents.ts).
          // У черновика номера нет — ссылаться на него по номеру нечему.
          if (target.id != null && owner.id != null) {
            return {elements: purgePropertyRefs(state.elements, target.id, owner.id)};
          }
          return {
            elements: state.elements.map(el => el.key === elementKey
              ? {...el, properties: (el.properties ?? []).filter(p => p !== target && p.name !== target.name)} as DiagramElement
              : el),
          };
        });
      },
      // Биндинги — клиентские данные (уезжают на сервер только с сохранением сцены),
      // поэтому их правки, в отличие от addTags/editProperty, ДОЛЖНЫ попадать в undo.
      addBinding: (elementKey, binding) => set(state => ({
        elements: state.elements.map(el =>
          el.key === elementKey
            ? {...el, bindings: [...(el.bindings ?? []), binding]} as DiagramElement
            : el
        ),
      })),
      updateBinding: (elementKey, bindingId, patch) => set(state => ({
        elements: state.elements.map(el =>
          el.key === elementKey
            ? {
                ...el,
                bindings: (el.bindings ?? []).map(b =>
                  b.id === bindingId ? {...b, ...patch} : b
                ),
              } as DiagramElement
            : el
        ),
      })),
      removeBinding: (elementKey, bindingId) => set(state => ({
        elements: state.elements.map(el =>
          el.key === elementKey
            ? {...el, bindings: (el.bindings ?? []).filter(b => b.id !== bindingId)} as DiagramElement
            : el
        ),
      })),
      deleteSelectedElement: async () => {
        const { selectedIds, elements, activeGroupKey, scene } = get();
        if (!selectedIds.length) return;

        // Каскад: удаляем выделенные + всех их потомков (children и composition, любой глубины).
        const descendantKeys = selectedIds.flatMap(key => getDescendantKeys(key, elements));

        const idsToDelete = new Set([...selectedIds, ...descendantKeys]);

        // Уцелевшие родители удаляемых: чистим их children/composition от висячих ключей
        // и пересчитываем рамки (иначе рамка остаётся растянутой под удалённое).
        const parentKeysToClean = new Set(
          elements
            .filter(el => idsToDelete.has(el.key) && el.parentKey && !idsToDelete.has(el.parentKey))
            .map(el => el.parentKey!)
        );

        let nextElements = elements
          .filter(el => !idsToDelete.has(el.key))
          .map(el =>
            parentKeysToClean.has(el.key)
              ? {
                  ...el,
                  children: el.children.filter(k => !idsToDelete.has(k)),
                  composition: (el.composition ?? []).filter(k => !idsToDelete.has(k)),
                } as DiagramElement
              : el
          );

        // Уцелевшим родителям пересчитываем рамку одним проходом: точкой входа
        // берём любого их оставшегося члена (цепочка предков от него включает
        // самого родителя).
        const membersToRecompute: string[] = [];
        const survivorsIndex = getElementIndex(nextElements);
        for (const parentKey of parentKeysToClean) {
          const parent = survivorsIndex.byKey[parentKey];
          if (!parent || parent.type !== "group") continue;
          const firstMember = [...(parent.children ?? []), ...(parent.composition ?? [])][0];
          if (firstMember) membersToRecompute.push(firstMember);
        }
        if (membersToRecompute.length) {
          nextElements = recomputeAncestorBounds(nextElements, membersToRecompute, scene?.id);
        }

        // Удаление живёт только локально и уезжает ближайшим сохранением: тело `PUT`
        // описывает состав сцены целиком, и компонента, которого в нём нет, сервер
        // удаляет сам. Отдельный `DELETE` тут был нужен старому upsert-`POST`, который
        // возвращал удалённое обратно; с новым контрактом это второй версионируемый
        // путь записи со своим 409 — и лишний.
        set({
          elements: nextElements,
          selectedIds: [],
          selectedTableCell: null,
          currentComponentStateByElementKey: Object.fromEntries(
            Object.entries(get().currentComponentStateByElementKey).filter(
              ([elementKey]) => !idsToDelete.has(elementKey)
            )
          ),
          // Если удалили группу, внутри которой находились — выходим из неё.
          ...(activeGroupKey && idsToDelete.has(activeGroupKey) ? {activeGroupKey: null} : {}),
        });
      },
      copySelectedElement: () => {
        const { selectedIds, elements } = get();
        if (!selectedIds.length) return;

        // Собираем все выделенные элементы и всех их потомков (для групп)
        const allKeys = new Set<string>();
        for (const key of selectedIds) {
          allKeys.add(key);
          getDescendantKeys(key, elements).forEach(k => allKeys.add(k));
        }

        set({ clipboard: elements.filter(el => allKeys.has(el.key)) });
        // Новый буфер — счётчики вставок с нуля (см. pasteSelectedElement).
        editorSession.pasteCount = 0;
        editorSession.lastPastePoint = null;
        editorSession.stackedPastes = 0;
        toast.success('Скопировано');
      },
      pasteSelectedElement: () => {
        const { clipboard, scene, currentProject } = get();
        if (!clipboard || !clipboard.length) return;

        // Тот же guard, что у addElementAt/addTemplate/importElementsFromJson: без
        // сцены корни получали parentKey "" и становились сиротами — они нигде не
        // рендерятся и молча отбрасываются buildComponentTree при сохранении.
        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя вставить: сцена не принадлежит выбранному проекту");
          return;
        }

        // Вставляем туда, где курсор: центр вставляемого набора встаёт под мышь.
        // Так вставка перестаёт быть лотереей «куда упадёт» — место выбирает человек.
        const pointer = getCanvasPointerWorld();
        let offset: {dx: number; dy: number};

        if (pointer) {
          const target = {x: snap(pointer.x), y: snap(pointer.y)};

          // Повторная вставка в ту же точку — лесенкой, иначе копии сложатся невидимо.
          if (editorSession.lastPastePoint && editorSession.lastPastePoint.x === target.x && editorSession.lastPastePoint.y === target.y) {
            editorSession.stackedPastes += 1;
          } else {
            editorSession.stackedPastes = 0;
          }
          editorSession.lastPastePoint = target;

          // Габарит считаем по самому буферу: у корней в нём свои координаты, а
          // getElementBoundsRendered умеет и линию (концы), и кривую с полигоном (точки).
          const roots = clipboard.filter(el => !clipboard.some(other => other.key === el.parentKey));
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const root of roots) {
            const b = getElementBoundsRendered(root, clipboard);
            if (!Number.isFinite(b.minX)) continue;
            minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
            maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
          }

          const step = editorSession.stackedPastes * GRID;
          offset = Number.isFinite(minX)
            ? {
                dx: snap(target.x - (minX + maxX) / 2) + step,
                dy: snap(target.y - (minY + maxY) / 2) + step,
              }
            : {dx: step, dy: step};
        } else {
          // Курсор над холстом ещё не появлялся — прежнее поведение: каскад от оригинала.
          editorSession.pasteCount += 1;
          offset = {dx: 60 * editorSession.pasteCount, dy: 60 * editorSession.pasteCount};
        }

        const {newElements, newRootKeys} = cloneElementsWithOffset(clipboard, scene, offset);

        set(state => ({
          elements: [...state.elements, ...newElements],
          selectedIds: newRootKeys,
        }));
      },
      duplicateSelected: () => {
        const { selectedIds, elements, scene } = get();
        if (!selectedIds.length) return;

        // Выделенные + все их потомки (как в copySelectedElement), но без буфера обмена.
        const allKeys = new Set<string>();
        for (const key of selectedIds) {
          allKeys.add(key);
          getDescendantKeys(key, elements).forEach(k => allKeys.add(k));
        }

        const {newElements, newRootKeys} = cloneElementsWithOffset(
          elements.filter(el => allKeys.has(el.key)),
          scene,
        );

        set(state => ({
          elements: [...state.elements, ...newElements],
          selectedIds: newRootKeys,
        }));
      },
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
            const {elements, scene, currentProject, versionPreview, sceneVersion} = get();

            if (!sceneBelongsToCurrentProject(scene, currentProject)) {
              if (!opts?.silent) toast.error("Сцена не принадлежит выбранному проекту");
              return false;
            }

            // Свойства теперь уезжают вместе со сценой, поэтому одно незаполненное
            // роняет сохранение ЦЕЛИКОМ («Property value_type is required for '…'»).
            // Бэкенд называет только имя свойства — говорим сами, у какого элемента
            // искать, и не тратим круг до сервера.
            const invalid = invalidProperties(elements);
            if (invalid.length) {
              if (!opts?.silent) {
                toast.error("Свойство заполнено не полностью", {
                  description: invalid.slice(0, 5).join("; ")
                    + (invalid.length > 5 ? ` и ещё ${invalid.length - 5}` : ""),
                  duration: 8_000,
                });
              }
              return false;
            }

            // В режиме просмотра на холсте лежит СТАРАЯ версия. Сохранить её значит
            // затереть текущую сцену чужим прошлым — молча и необратимо. Автосейв сюда
            // приходит без участия человека, поэтому проверка именно здесь, а не в UI.
            if (versionPreview) {
              if (!opts?.silent) toast.error("Идёт просмотр версии — сохранение недоступно");
              return false;
            }

            // `scene_id` обязателен в конверте `PUT`: тело описывает состав ИМЕННО этой
            // сцены. Без числового id сохранять нельзя — сервер не поймёт, чей состав
            // ему прислали, а угадывать здесь опаснее всего: тело читается как «вот
            // сцена целиком», и промах адресом стёр бы чужую сцену.
            const sceneId = Number(scene?.id);
            if (!Number.isSafeInteger(sceneId)) {
              if (!opts?.silent) toast.error("Сцена не сохранена на сервере — сохранять состав нечему");
              return false;
            }

            const components = buildComponentTree(elements, String(scene?.id));
            const basedOnVersion = opts?.basedOnVersion ?? sceneVersion;
            // Поколение документа НА МОМЕНТ отправки. Если к возврату ответа оно выросло,
            // холст успели заменить (восстановление версии, просмотр, перезагрузка сцены),
            // и подменять его нашим деревом уже нельзя — см. documentGeneration.
            const generationAtSend = editorSession.documentGeneration;

            // `PUT`, а не `POST`: `POST` только создаёт компоненты и не принимает
            // `scene_id`, а слияние чужих правок сервер делает исключительно для `PUT`
            // с `save_kind: "MANUAL"`. В теле — весь состав сцены (buildComponentTree
            // сериализует все элементы), поэтому удалённое исчезает по отсутствию.
            const res = await fetch("/api/editor/components", {
              method: "PUT",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({
                components,
                scene_id: sceneId,
                save_kind: opts?.kind ?? "MANUAL",
                // Версий нет — это первое сохранение, и поле не отправляем вовсе
                // (прислать его при отсутствующих версиях — 400 по контракту).
                ...(basedOnVersion != null ? {based_on_version: basedOnVersion} : {}),
              }),
            });

            // 409 — сцену успел сохранить кто-то другой. Это не ошибка сохранения:
            // правки пользователя целы, их надо показать рядом с чужими и дать решить.
            // Поэтому ни тоста, ни сброса isDirty, ни перезагрузки сцены.
            if (res.status === 409) {
              const body = await res.json().catch(() => null);
              const conflict: SaveConflict = isSaveConflictBody(body)
                ? body
                : {error: "version_mismatch", base_version: basedOnVersion ?? null, current_version: null};

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

            if (!res.ok) {
              const text = await res.text();
              throw new Error(parseBackendErrorMessage(res.status, text));
            }

            const saved = await res.json().catch(() => null);
            const savedComponents: Record<string, unknown>[] = Array.isArray(saved?.components)
              ? saved.components
              : [];
            const savedVersion: number | null =
              typeof saved?.version_no === "number" ? saved.version_no : null;

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
              if (saved?.merged) reportMergedChanges(saved.merged as MergeReport);
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

            if (saved?.merged) reportMergedChanges(saved.merged as MergeReport);

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
              const temporal = useEditorStore.temporal.getState();
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
                useEditorStore.temporal.getState().resume();
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
                const t = useEditorStore.temporal.getState();
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
          if (wasPreviewing) useEditorStore.temporal.getState().resume();
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

        useEditorStore.temporal.getState().resume();
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
            if (get().versionPreview) useEditorStore.temporal.getState().resume();
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

            const temporal = useEditorStore.temporal.getState();
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
              useEditorStore.temporal.getState().resume();
            }

            // Стек undo помнит элементы ДО восстановления, часть из которых на сервере
            // уже не существует — оставлять его значит дать Ctrl+Z воскресить их.
            useEditorStore.temporal.getState().clear();

            if (trustResponse) {
              set({sceneVersion: restored.version_no, saveConflict: null, staleBaseVersion: null, autosaveError: null});
              markSceneSaved(true);
            } else {
              // loadScene уже расставил elements/снимок и сам спросил текущую версию.
              set({saveConflict: null, staleBaseVersion: null, autosaveError: null});
            }
            void get().loadVersions();

            // `restored_from` называет версию, которую сервер ВЗЯЛ за источник. Расхождение
            // с запрошенной означает, что восстановлено не то, — и без этой проверки такой
            // ответ неотличим от успеха: тост бодро называет запрошенный номер, а на холсте
            // чужое содержимое.
            if (restored.restored_from != null && restored.restored_from !== versionNo) {
              toast.warning(`Сервер восстановил версию ${restored.restored_from}, а не ${versionNo}`, {
                description: "На холсте содержимое версии " + restored.restored_from +
                  ". Если это повторяется, история версий на сервере отдаёт не тот снимок.",
                duration: 12_000,
              });
            } else if (!trustResponse) {
              toast.warning(`Версия ${versionNo} восстановлена, схема перечитана с сервера`, {
                description: "Ответ восстановления пришёл в неожиданном виде, поэтому холсту он не доверен.",
                duration: 10_000,
              });
            } else {
              toast.success(`Восстановлена версия ${versionNo}`);
            }
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
          // Тянем ВСЕ виды, а не только MANUAL: чтобы понять, «предыдущее» относительно
          // чего искать, надо увидеть и записи RESTORE. Список отфильтрованный по MANUAL
          // после восстановления не меняется вовсе — по нему шаг назад всегда упирался
          // в одну и ту же версию, и повторные нажатия возвращали то же самое состояние.
          const all = await fetchVersions("scenes", Number(sceneId), {limit: VERSIONS_PAGE_SIZE});

          if (!all.length) {
            toast.info("Предыдущего ручного сохранения нет");
            return false;
          }

          // Что лежит на холсте сейчас. sceneVersion может отставать (бэкенд не всегда
          // отдаёт version_no) — тогда берём самую свежую запись истории.
          const current = get().sceneVersion;
          const head = all.find(v => v.version_no === current) ?? all[0];

          // Для RESTORE содержимое равно версии-источнику: шаг назад надо делать от неё,
          // иначе «отменить отмену» вернуло бы ту же самую версию по кругу.
          const contentVersion =
            head.kind === "RESTORE" && head.restored_from != null ? head.restored_from : head.version_no;

          // Список свежие-первыми, поэтому первая подходящая строка — ближайшая старшая.
          const previous = all.find(v => v.kind === "MANUAL" && v.version_no < contentVersion);

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
      loadProjectList: async () => {
        try {
          const res = await fetch("/api/editor/projects");

          if (!res.ok) {
            throw new Error(parseBackendErrorMessage(res.status, await res.text().catch(() => "")));
          }

          const json = await res.json();
          const projects = normalizeProjectList(json);
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
          const res = await fetch(`/api/editor/projects/${projectId}/runtime`);
          if (!res.ok) return;
          const info = parseRuntimeInfo(await res.json().catch(() => null));
          if (!info) return;
          set(state => ({
            projectRuntimeFlags: {...state.projectRuntimeFlags, [projectId]: info.inOperation},
            projectProdVersions: {...state.projectProdVersions, [projectId]: info.prodVersionNo},
          }));
        } catch (err: unknown) {
          console.error(err);
        }
      },
      /**
       * Ввод и вывод из эксплуатации. Пишем точечно, НЕ через `setCurrentProject`: тот
       * разрушительный — гасит открытую схему, элементы, список сцен и историю undo.
       */
      setProjectInOperation: async (projectId: number, inOperation: boolean) => {
        const adopt = (info: {inOperation: boolean; prodVersionNo: number | null}) => set(state => ({
          projectRuntimeFlags: {...state.projectRuntimeFlags, [projectId]: info.inOperation},
          projectProdVersions: {...state.projectProdVersions, [projectId]: info.prodVersionNo},
        }));
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
        const {scene, currentProject} = get();
        if (scene && currentProject?.id === projectId && hasUnsavedWork()) {
          const ok = await confirmModal({
            title: "Сохранить схему перед выпуском?",
            description: "Выпуск снимает то, что сохранено на сервере. Несохранённые правки "
              + "открытой схемы в него не попадут.",
            confirmLabel: "Сохранить и выпустить",
          });
          if (!ok) return null;
          if (!await get().exportScene({kind: "MANUAL"})) return null;
        }
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
          set(state => ({
            projectRuntimeFlags: {...state.projectRuntimeFlags, [projectId]: info.inOperation},
            projectProdVersions: {...state.projectProdVersions, [projectId]: info.prodVersionNo},
          }));
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
        const {scene, currentProject} = get();

        // Автопривязка пишет новую версию сцены: несохранённая правка после неё упрётся в
        // расхождение версий (слияние или 409). Поэтому спрашиваем ДО запроса.
        if (scene && currentProject?.id === projectId && hasUnsavedWork()) {
          const ok = await confirmModal({
            title: "Сохранить схему перед автопривязкой?",
            description: "Автопривязка запишет новую версию схемы. Если не сохранить сейчас, "
              + "текущие правки потом упрутся в расхождение версий.",
            confirmLabel: "Сохранить и привязать",
          });
          if (!ok) return null;
          if (!await get().exportScene({kind: "MANUAL"})) return null;
        }

        try {
          const res = await fetch(`/api/editor/projects/${projectId}/autobind`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({channel_root: channelRoot}),
          });
          if (!res.ok) {
            // Тело ошибки — `{timestamp, status, error, message}`; сырой JSON в тосте
            // пользователь читает как «ничего не произошло».
            throw new Error(parseBackendErrorMessage(res.status, await res.text().catch(() => "")));
          }
          const report = await res.json() as AutobindReport;

          // Открытую сцену перечитываем, иначе на холсте останутся прежние теги, а ближайшее
          // сохранение затрёт автопривязку. Только для текущего проекта: `loadScene` берёт
          // проект из `currentProject`, и для чужой сцены проверка принадлежности сбросит холст.
          const openScene = get().scene;
          if (currentProject?.id === projectId && openScene
            && report.scenes.some(s => s.scene_id === Number(openScene.id))) {
            const temporal = useEditorStore.temporal.getState();
            temporal.pause();
            try {
              await get().loadScene(Number(openScene.id), {keepHistory: true});
            } finally {
              useEditorStore.temporal.getState().resume();
            }
            // Историю чистим: шаг undo вернул бы прежние теги поверх только что проставленных.
            useEditorStore.temporal.getState().clear();
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
          const res = await fetch("/api/editor/project", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({name}),
          });

          if (!res.ok) {
            throw new Error(await res.text().catch(() => "Ошибка создания проекта"));
          }

          const created = await res.json();
          const newProject = toEditorProject(created);
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
        useEditorStore.temporal.getState().clear();
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
            useEditorStore.temporal.getState().clear();
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
          useEditorStore.temporal.getState().clear();

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
      groupSelected: () => {
        const {elements, selectedIds, scene} = get();
        if (selectedIds.length < 2) return;

        const topLevelSelected = elements
          .filter(el => selectedIds.includes(el.key))
          .filter(el => {
            let parentKey: string | null | undefined = el.parentKey;

            while (parentKey) {
              if (selectedIds.includes(parentKey)) return false;
              parentKey = elements.find(e => e.key === parentKey)?.parentKey;
            }

            return true;
          }) as DiagramElement[];

        if (topLevelSelected.length < 2) return;

        const simple = topLevelSelected.filter(el => !isGroup(el) && !isComplex(el));
        const complex = topLevelSelected.filter(isComplex);
        const groups = topLevelSelected.filter(isGroup);

        if (simple.length > 0 && complex.length === 0 && groups.length === 1) {
          const targetGroup = groups[0] as GroupElement;
          const simpleKeys = simple.map(s => s.key);
          // ВАЖНО: включаем composition (запечённые примитивы компонента) в состав —
          // иначе рамка считается без них, а их локальные координаты не компенсируются
          // при сдвиге origin группы.
          const allMemberKeys = [
            ...new Set([
              ...(targetGroup.children ?? []),
              ...(targetGroup.composition ?? []),
              ...simpleKeys,
            ]),
          ];

          const boundsByKey = snapshotBounds(elements, allMemberKeys);

          let updatedElements = layoutGroupFromBounds(
            elements,
            targetGroup.key,
            allMemberKeys,
            boundsByKey,
            GROUP_PADDING,
            scene?.id,
          );

          // layoutGroupFromBounds кладёт ВСЕХ членов в children. Для компонента
          // переразбиваем состав по роли: примитивы → composition, компоненты → children,
          // иначе примитивы сериализуются как вложенные компоненты (порча данных).
          if (isComponentEl(targetGroup)) {
            updatedElements = resplitContainer(updatedElements, targetGroup.key, allMemberKeys);
          }

          // Новые члены получают весь набор состояний контейнера — иначе панель
          // «Состояния» показывает у них одно состояние против четырёх у компонента.
          updatedElements = syncMemberStates(updatedElements, targetGroup.key, allMemberKeys);

          set({
            elements: updatedElements,
            selectedIds: [targetGroup.key],
          });

          return;
        }

        const newGroupId = createUuid();
        const selectedKeys = topLevelSelected.map(el => el.key);
        const parentKeys = [...new Set(topLevelSelected.map(el => el.parentKey).filter(Boolean))];
        // Без сцены фолбэк — null (а не литерал "undefined" от String(undefined)).
        const commonParentKey = parentKeys.length === 1 ? parentKeys[0] : (scene ? String(scene.id) : null);
        const commonParentElement = commonParentKey
          ? elements.find(el => el.key === commonParentKey && el.type === "group") as GroupElement | undefined
          : undefined;
        const newGroupParentId = commonParentKey === String(scene?.id)
          ? scene?.id || null
          : commonParentElement?.id ?? null;

        const boundsByKey = snapshotBounds(elements, selectedKeys);
        const box = unionBounds([...boundsByKey.values()], GROUP_PADDING);
        const parentAbs = resolveParentAbsolute(commonParentKey, elements, scene?.id);

        let updatedElements = elements.map(el => {
          if (!selectedKeys.includes(el.key)) return el;

          const bounds = boundsByKey.get(el.key)!;
          return {
            ...elementToGroupLocal(el, bounds, box.absX, box.absY),
            parentKey: newGroupId,
            parentId: null,
          };
        });

        if (commonParentElement) {
          updatedElements = updatedElements.map(el => {
            if (el.key !== commonParentElement.key) return el;

            const nextChildren = el.children.filter(childKey => !selectedKeys.includes(childKey));
            const insertIndex = el.children.findIndex(childKey => selectedKeys.includes(childKey));

            if (insertIndex >= 0) {
              nextChildren.splice(insertIndex, 0, newGroupId);
            } else {
              nextChildren.push(newGroupId);
            }

            return {...el, children: nextChildren};
          });
        }

        const group: GroupElement = {
          id: null,
          key: newGroupId,
          type: "group",
          x: box.absX - parentAbs.x,
          y: box.absY - parentAbs.y,
          w: box.w,
          h: box.h,
          composition: [],
          children: selectedKeys,
          parentId: newGroupParentId,
          parentKey: commonParentKey,
          label: `Group (${topLevelSelected.length})`,
          bg: "rgba(59,130,246,0.08)",
          borderStyle: "dashed",
          borderColor: "#3b82f6",
          scripts: [],
          bindings: [],
          properties: [],
          states: [{
            id: createUuid(),
            name: "Нормальное",
            overrides: {},
            isDefault: true,
          }],
        };

        set({
          elements: [...updatedElements, group],
          selectedIds: [newGroupId],
        });
      },
      ungroupSelected: async () => {
        const { elements, selectedIds, activeGroupKey, scene } = get();

        // 1. Находим среди выделенных элементов только группы
        const groupsToUngroup = elements.filter(
          (el) => selectedIds.includes(el.key) && el.type === "group"
        );

        // Если не выделено ни одной группы, ничего не делаем
        if (groupsToUngroup.length === 0) return;

        const groupIdsToRemove = groupsToUngroup.map((g) => g.key);

        // Здесь мы соберем ID элементов, которые освободятся из-под групп,
        // чтобы автоматически сделать их выделенными после разгруппировки
        const newlySelectedIds: string[] = [];

        // Работаем с копией массива элементов
        let updatedElements = [...elements];

        // Проходимся по каждой группе, которую нужно разбить
        groupsToUngroup.forEach((group) => {
          const {
            key: groupId,
            x: groupX,
            y: groupY,
            parentKey: grandParentKey,
          } = group;

          // Члены группы — и children (компоненты/узлы), и composition (примитивы компонента).
          const memberKeys = [...(group.children ?? []), ...(group.composition ?? [])];
          newlySelectedIds.push(...memberKeys);

          // parentId «дедушки»: корень сцены → id сцены, группа → её серверный id
          // (null, если она ещё не сохранена — бэкенд свяжет по parent_key).
          const grandParentId =
            grandParentKey === String(scene?.id)
              ? scene?.id ?? null
              : (updatedElements.find((el) => el.key === grandParentKey)?.id ?? null);

          // Шаг А: Обновляем ВСЕХ членов разбиваемой группы (по parentKey — покрывает
          // и children, и composition). Прибавляем координаты исчезающей группы, причём
          // сдвигаем и базовые поля, и позиционные ключи в overrides состояний:
          // у перемещённого внутри группы листа актуальная позиция живёт в overrides,
          // и сдвиг только базового x/y «телепортирует» его на старое место.
          // parentId переписываем вместе с parentKey: иначе в нём остаётся серверный id
          // удалённой группы, и сохранение падает с 400 «Component not found».
          updatedElements = updatedElements.map((el) => {
            if (el.parentKey === groupId) {
              return {
                ...shiftElementPositions(el, groupX, groupY),
                // Член переходит под крыло "дедушки" (если группа сама была внутри группы)
                parentKey: grandParentKey,
                parentId: grandParentId,
              };
            }
            return el;
          });

          // Шаг Б: Если удаляемая группа лежала ВНУТРИ другой группы ("дедушки") —
          // вливаем членов в прародителя с учётом роли (примитивы → composition,
          // компоненты → children), иначе примитивы-члены осиротеют.
          if (grandParentKey) {
            const grandParent = updatedElements.find(
              (el) => el.key === grandParentKey && el.type === "group",
            );
            if (grandParent) {
              const mergedMemberKeys = [
                ...grandParent.children.filter((key) => key !== groupId),
                ...(grandParent.composition ?? []).filter((key) => key !== groupId),
                ...memberKeys,
              ];
              if (isComponentEl(grandParent)) {
                updatedElements = resplitContainer(updatedElements, grandParentKey, mergedMemberKeys);
                updatedElements = syncMemberStates(updatedElements, grandParentKey, memberKeys);
              } else {
                // «Глупая» группа держит всё в children.
                updatedElements = updatedElements.map((el) =>
                  el.key === grandParentKey
                    ? {...el, children: mergedMemberKeys, composition: []}
                    : el,
                );
              }
            }
          }
        });

        // 2. Окончательно удаляем сами разбитые группы из массива
        updatedElements = updatedElements.filter((el) => !groupIdsToRemove.includes(el.key));

        // 3. Сохраняем в выделении обычные фигуры, которые были выделены вместе с группами
        const retainedSelectedIds = selectedIds.filter((id) => !groupIdsToRemove.includes(id));

        // Разбитые группы исчезают на сервере сами: состав сцены уезжает целиком в
        // `PUT`, и группы, которой в теле нет, после сохранения не будет. Раньше здесь
        // требовался явный `DELETE` — старый `POST` был upsert-ом и возвращал группу
        // обратно после следующего сохранения.
        set({
          elements: updatedElements,
          selectedIds: [...retainedSelectedIds, ...newlySelectedIds],
          // Если разбили группу, внутри которой находились — выходим из неё.
          ...(activeGroupKey && groupIdsToRemove.includes(activeGroupKey) ? {activeGroupKey: null} : {}),
        });
      },
      createComponentFromGroup: (groupKey, name) => {
        set(state => {
          const elements = state.elements;
          const group = elements.find(el => el.key === groupKey);
          if (!group || group.type !== "group") return {};

          const primitiveKeys: string[] = [];
          const componentKeys: string[] = [];
          const dissolvedGroupKeys = new Set<string>();
          // key -> накопленный сдвиг для перевода в координатное пространство компонента
          const offsetByKey = new Map<string, {dx: number; dy: number}>();
          const reparent = new Set<string>();

          // Обходим поддерево: примитивы (в т.ч. из вложенных «глупых» групп) → composition,
          // компоненты → children; обычные под-группы расформировываем, накапливая их смещение.
          const walk = (containerKey: string, dx: number, dy: number) => {
            for (const kid of elements.filter(e => e.parentKey === containerKey)) {
              if (isLeafPrimitive(kid)) {
                primitiveKeys.push(kid.key);
                offsetByKey.set(kid.key, {dx, dy});
                reparent.add(kid.key);
              } else if (isComponentEl(kid)) {
                componentKeys.push(kid.key);
                offsetByKey.set(kid.key, {dx, dy});
                reparent.add(kid.key);
              } else {
                // обычная под-группа: узел исчезает, дети поднимаются в компонент
                dissolvedGroupKeys.add(kid.key);
                walk(kid.key, dx + kid.x, dy + kid.y);
              }
            }
          };
          walk(groupKey, 0, 0);

          const shift = (el: DiagramElement): DiagramElement => {
            const off = offsetByKey.get(el.key) ?? {dx: 0, dy: 0};
            const leaf = el as import("@/types/editorElement.type").LeafElement;
            return {
              ...el,
              parentKey: groupKey,
              parentId: group.id,
              x: el.x + off.dx,
              y: el.y + off.dy,
              ...(leaf.x1 !== undefined ? {x1: leaf.x1 + off.dx} : {}),
              ...(leaf.y1 !== undefined ? {y1: leaf.y1 + off.dy} : {}),
              ...(leaf.x2 !== undefined ? {x2: leaf.x2 + off.dx} : {}),
              ...(leaf.y2 !== undefined ? {y2: leaf.y2 + off.dy} : {}),
            } as DiagramElement;
          };

          const updated = elements
            .filter(el => !dissolvedGroupKeys.has(el.key))
            .map(el => {
              if (el.key === groupKey) {
                return {
                  ...el,
                  isComponent: true,
                  composition: primitiveKeys,
                  children: componentKeys,
                  label: name ?? el.label ?? "Компонент",
                } as DiagramElement;
              }
              if (reparent.has(el.key)) return shift(el);
              return el;
            });

          // Примитивы, ставшие составом компонента, получают его состояния.
          return {
            elements: syncMemberStates(updated, groupKey, [...primitiveKeys, ...componentKeys]),
            selectedIds: [groupKey],
          };
        });
      },
      disassembleComponent: (componentKey) => {
        set(state => {
          const group = state.elements.find(el => el.key === componentKey);
          if (!group || group.type !== "group") return {};

          const composition = group.composition ?? [];
          return {
            elements: state.elements.map(el =>
              el.key === componentKey
                ? ({
                    ...el,
                    isComponent: false,
                    children: [...el.children, ...composition],
                    composition: [],
                  } as DiagramElement)
                : el,
            ),
          };
        });
      },
      moveElementToGroup: (elementKey, targetGroupKey) => {
        const { elements, scene } = get();
        const element = elements.find(el => el.key === elementKey);
        const targetGroup = elements.find(el => el.key === targetGroupKey);

        if (!element || !targetGroup || targetGroup.type !== "group") return;

        const oldParentKey = element.parentKey;

        // Полный состав целевого контейнера + перемещаемый — для расчёта рамки.
        const targetMemberKeys = [
          ...new Set([
            ...(targetGroup.children ?? []),
            ...(targetGroup.composition ?? []),
            elementKey,
          ]),
        ];
        const targetBoundsByKey = snapshotBounds(elements, targetMemberKeys);

        // Убираем перемещаемый из ОБОИХ списков старого родителя.
        let updatedElements = elements.map(el => {
          if (el.key === oldParentKey && el.type === "group" && oldParentKey !== targetGroupKey) {
            return {
              ...el,
              children: el.children.filter(k => k !== elementKey),
              composition: (el.composition ?? []).filter(k => k !== elementKey),
            } as DiagramElement;
          }
          return el;
        });

        updatedElements = layoutGroupFromBounds(
          updatedElements,
          targetGroupKey,
          targetMemberKeys,
          targetBoundsByKey,
          GROUP_PADDING,
          scene?.id,
        );

        // layoutGroupFromBounds сложил все ключи в children — переразбиваем по роли.
        updatedElements = resplitContainer(updatedElements, targetGroupKey, targetMemberKeys);
        updatedElements = syncMemberStates(updatedElements, targetGroupKey, targetMemberKeys);

        if (oldParentKey && oldParentKey !== targetGroupKey) {
          const oldGroup = updatedElements.find(
            el => el.key === oldParentKey && el.type === "group",
          ) as GroupElement | undefined;

          const oldMembers = oldGroup
            ? [...oldGroup.children, ...(oldGroup.composition ?? [])]
            : [];

          if (oldMembers.length) {
            const oldBoundsByKey = snapshotBounds(updatedElements, oldMembers);
            updatedElements = layoutGroupFromBounds(
              updatedElements,
              oldParentKey,
              oldMembers,
              oldBoundsByKey,
              GROUP_PADDING,
              scene?.id,
            );
            updatedElements = resplitContainer(updatedElements, oldParentKey, oldMembers);
            updatedElements = syncMemberStates(updatedElements, oldParentKey, oldMembers);
          }
        }

        set({ elements: updatedElements });
      }
    }),
    {
      limit: 50,
      partialize: (state) => ({
        elements: state.elements,
      }),
      // Пишем в историю ТОЛЬКО когда реально изменился массив elements.
      // Иначе zundo фиксирует снапшот на каждый set() (камера/зум/пан, выделение и т.п.)
      // и стек заполняется «пустыми» дублями — Ctrl+Z приходится жать много раз.
      // Все мутации элементов создают новый массив, поэтому сравнения по ссылке достаточно.
      equality: (a, b) => a.elements === b.elements,
    }
  )
);

// Общие хелперы (editorStoreInternals) берут стор отсюда — импортировать его сами не могут.
bindEditorStore(useEditorStore);

/**
 * Подчищает выделение, когда выделенных элементов больше нет в `elements`.
 *
 * История undo хранит только `elements` (см. partialize), поэтому отмена вставки
 * или дублирования возвращает массив элементов, а `selectedIds` остаются ключами
 * уже несуществующих копий: панель свойств пустела, а кнопки группировки в
 * ToolsPanel оставались активными (они смотрят на `selectedIds.length`).
 *
 * Сам `set` историю не пишет: `equality` сравнивает ссылку на `elements`, а она
 * здесь не меняется.
 */
useEditorStore.subscribe((state, prev) => {
  if (state.elements === prev.elements) return;

  // Флаг «есть несохранённые изменения» — здесь же, чтобы не заводить второй
  // подписчик на тот же самый сигнал.
  const dirty = state.elements !== editorSession.savedElementsSnapshot;
  if (dirty !== state.isDirty) useEditorStore.setState({isDirty: dirty});

  if (state.selectedIds.length === 0 && state.activeGroupKey === null) return;

  const keys = new Set(state.elements.map(el => el.key));
  const nextSelected = state.selectedIds.filter(k => keys.has(k));
  const activeGone = state.activeGroupKey !== null && !keys.has(state.activeGroupKey);

  if (nextSelected.length === state.selectedIds.length && !activeGone) return;

  useEditorStore.setState({
    selectedIds: nextSelected,
    ...(activeGone ? {activeGroupKey: null} : {}),
  });
});
