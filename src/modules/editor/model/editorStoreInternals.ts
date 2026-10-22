/**
 * Общие хелперы стора редактора, которые нужны нескольким его зонам: подмена документа
 * серверным деревом, загрузка сцены, просмотр версии, признак несохранённого, права.
 *
 * Перенесены из `src/store/useEditorStore.ts` без изменения логики (docs/architecture.md,
 * шаг 6): со стором работают через `editorStore()`, общие буферы — в `editorSession`.
 */
import {toast} from "sonner";
import type {DiagramElement, SceneType} from "@/types/editorElement.type";
import type {PropertyCreateRequestDto} from "@/types/tags.types";
import type {MergeReport, VersionPreview} from "@/types/editorVersion.types";
import {useRuntimeOverlayStore} from "@/core/scene";
import {useSessionUserStore} from "@/store/useSessionUserStore";
// переедут в core/scene и core/access вместе с остальным lib (шаг 8)
import {errorTextFromBody} from "@/lib/access/accessErrors";
import {grantOf} from "@/lib/access/grants";
import transformElements from "@/lib/transformElements";
import {rootComponentsOf} from "@/lib/editor/documentComponents";
import {dropScene, fetchSceneWithVersion, prefetchScenes, type SceneSource} from "@/lib/editor/sceneCache";
import {readPinnedTabs} from "@/lib/editor/pinnedScenes";
import {fetchCurrentVersion} from "@/lib/editor/versionsApi";
import {editorSession} from "./editorSession";
import {editorStore} from "./editorStoreRef";

/**
 * Сцена принадлежит текущему выбранному проекту, если:
 *  - выбран какой-то проект (currentProject !== null),
 *  - сцена задана,
 *  - сцена содержит project_id, совпадающий с currentProject.id.
 *
 * Если бэкенд не прислал project_id (старая версия / нестандартный ответ),
 * считаем, что иерархия не нарушена — но записываем project_id из
 * currentProject, чтобы последующие проверки были детерминированными.
 */
export const sceneBelongsToCurrentProject = (
  scene: SceneType | null,
  currentProject: {id: number; name: string} | null,
): boolean => {
  if (!currentProject) return false;
  if (!scene) return false;
  if (scene.project_id == null) return true;
  return scene.project_id === currentProject.id;
};

export const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/**
 * Бэкенд отдаёт ошибки JSON-телом `{status, message, error, timestamp}`
 * (Spring `ErrorResponse`), а отказы в доступе — `{error: "FORBIDDEN", reason}`.
 * Достаём человеческий текст — иначе тост показывает сырой JSON-блоб.
 */
export const parseBackendErrorMessage = errorTextFromBody;

/**
 * Есть ли у пользователя право правки текущего проекта (`access.edit` из списка проектов,
 * администратору — всегда). С одним «просмотром» редактор открывается и правится
 * локально, но всё, что пишет на сервер, должно молча (автосейв) или с пояснением
 * (ручные действия) остановиться здесь — бэкенд ответил бы 403 NO_EDIT.
 */
export const canWriteCurrentProject = (): boolean => {
  const {currentProject, projectList} = editorStore().getState();
  if (!currentProject) return false;
  const fromList = projectList.find(p => p.id === currentProject.id);
  return grantOf(fromList ?? currentProject, useSessionUserStore.getState().admin).edit;
};

/** Ручное действие в режиме просмотра: объяснить, почему ничего не произошло. */
export const refuseViewOnly = (): false => {
  toast.info("Только просмотр — сохранение недоступно");
  return false;
};

/**
 * Массовое удаление документов и компонентов — единственный оставшийся адрес удаления.
 *
 * Поштучных `DELETE /api/editor/components/{id}` и `.../components/scene/{id}` на бэкенде
 * больше нет (они отвечали 500). Теперь это конверт `{ids, based_on_version}` на
 * `DELETE /api/editor/components` (§1 контракта версий).
 *
 * `based_on_version` уходит ТОЛЬКО когда номер реально известен: у сцены без единой
 * версии это поле — 400 (то же правило, что у сохранения). `DELETE` версию сверяет, но не
 * сливает: расхождение — безусловный 409.
 */
export const deleteComponentsRequest = async (ids: number[], basedOnVersion?: number | null) => {
  const res = await fetch('/api/editor/components', {
    method: 'DELETE',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      ids,
      ...(typeof basedOnVersion === 'number' ? {based_on_version: basedOnVersion} : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseBackendErrorMessage(res.status, text));
  }
};



/** Метка нашего формата файла схемы — по ней импорт отличает свой файл от чужой выгрузки. */
export const SCENE_EXPORT_FORMAT = "SCADA_EDITOR_SCENE";

/** Файл экспорта схемы: конверт с метаданными и плоским массивом элементов. */
export interface SceneExportFile {
  format: typeof SCENE_EXPORT_FORMAT;
  version: number;
  exported_at: string;
  scene: {name: string | null};
  elements: Record<string, unknown>[];
}






/**
 * Кладёт дерево компонентов, пришедшее с сервера, в `elements`.
 *
 * Общий путь для загрузки сцены, сохранения и восстановления версии: распаковка
 * (`transformElements` — unbake запечённой composition) не должна разъехаться между
 * ними. Выделение/активная группа/состояния сбрасываются, потому что ключи после
 * серверного круга могут исчезнуть; вызывающий восстанавливает их сам, если нужно.
 *
 * Здесь же растёт `documentGeneration`: это единственная точка, где документ на холсте
 * заменяется целиком, а значит единственное место, откуда операции могут узнать, что их
 * ответ уже устарел.
 */
export const applyServerComponents = (
  components: unknown[],
  scene: {id?: number | string; key?: string} | null,
): DiagramElement[] => {
  const elements = transformElements(
    (components ?? []) as Parameters<typeof transformElements>[0],
    scene,
  );

  editorSession.documentGeneration += 1;

  // Рантайм-оверрайды принадлежат ПРЕДЫДУЩЕМУ документу и обнуляются по той же причине,
  // что и состояния ниже. Ключи элементов переживают серверный круг (см.
  // transformElements), поэтому `setProp` прошлого визита на схему иначе лёг бы поверх
  // заново загруженной (в getRenderedElement рантайм применяется последним), а записи по
  // ключам других схем копились бы в карте всю сессию.
  //
  // Не через `clearRuntime()`: тот сбрасывает ещё и ручные значения оператора, а они
  // привязаны к сессии, а не к схеме, и от переключения слетать не должны. Актуальные
  // значения движок пересчитает сразу после смены elements — он прогоняет биндинги по
  // уже известным значениям (см. useRuntimeEngine, эффект на index).
  //
  // Сбрасываем ДО смены elements: новый документ не должен ни на кадр получить чужие оверрайды.
  useRuntimeOverlayStore.getState().resetOverrides();

  editorStore().setState({
    elements,
    selectedIds: [],
    activeGroupKey: null,
    selectedTableCell: null,
    editAllStates: false,
    currentComponentStateByElementKey: {},
  });

  return elements;
};


/**
 * Кладёт на холст сцену, полученную целиком (из сети или из кэша сцен).
 *
 * `version` — номер версии ИМЕННО этого документа: он станет `based_on_version`
 * следующего сохранения. `null` — версий нет (или номер не узнали).
 * false — сцена не из текущего проекта, холст очищен.
 */
export const applyLoadedScene = (scene: Record<string, unknown>, version: number | null): boolean => {
  const {currentProject} = editorStore().getState();
  // Иерархия: сцена обязана принадлежать выбранному проекту.
  if (!sceneBelongsToCurrentProject(scene as unknown as SceneType, currentProject)) {
    toast.error("Сцена не принадлежит выбранному проекту");
    editorStore().setState({scene: null, elements: [], selectedIds: [], activeGroupKey: null, selectedTableCell: null, currentComponentStateByElementKey: {}});
    return false;
  }

  editorStore().setState({scene: scene as unknown as SceneType});
  applyServerComponents((scene?.children as unknown[]) ?? [], scene as {id?: number | string});
  // Только что загруженная сцена не считается изменённой.
  // persisted=false: время последнего сейва загрузкой не обновляем.
  markSceneSaved(false);
  // Версии прошлой сцены к этой не относятся — сбрасываем всё разом.
  editorStore().setState({
    sceneVersion: version, versions: [], versionsExhausted: false,
    saveConflict: null, staleBaseVersion: null, autosaveError: null,
  });
  return true;
};

/**
 * Проверка свежести схемы, показанной из кэша.
 *
 * Номер версии совпал — показано актуальное, ничего не делаем (обычный случай: один
 * лёгкий запрос вместо сборки всего дерева). Не совпал — перечитываем схему и тихо
 * подменяем, но только если пользователь её ещё не тронул. Если тронул — не подменяем:
 * `sceneVersion` остаётся номером показанного документа, и сохранение пойдёт обычным
 * путём конфликта (ручное — диалог слияния, автосохранение — баннер). Своей логики
 * слияния здесь нет и быть не должно.
 */
export const revalidateCachedScene = async (
  projectId: number,
  sceneId: number,
  shownVersion: number | null,
  generation: number,
): Promise<void> => {
  try {
    const latest = await fetchCurrentVersion("scenes", sceneId);
    if (latest === shownVersion) return;

    const {scene, version} = await fetchSceneWithVersion(projectId, sceneId, {fresh: true});
    const s = editorStore().getState();
    if (
      editorSession.documentGeneration !== generation
      || s.scene?.id !== sceneId
      || s.currentProject?.id !== projectId
      || s.isDirty
      || s.versionPreview
    ) return;

    applyLoadedScene(scene, version ?? null);
    if (version === undefined) void s.refreshSceneVersion();
    // Шагов undo у нетронутой схемы нет, но подмена документа — граница истории.
    editorStore().temporal.getState().clear();
  } catch (err) {
    // Молча: показанная схема остаётся, а сохранение всё равно сверит версию.
    console.warn("[scene-cache] не удалось проверить свежесть схемы:", err);
  }
};

/**
 * Фоновая загрузка всех схем проекта в кэш — чтобы быстрым был и ПЕРВЫЙ переход.
 *
 * Отложена до простоя браузера: сначала должна спокойно загрузиться схема, которую
 * открывают прямо сейчас. Закреплённые схемы (вкладки) — первыми в очереди, на них
 * переходят чаще всего. Сменили проект — очередь старого останавливается.
 */
export const scheduleScenePrefetch = (projectId: number, list: {id: number}[], source: SceneSource) => {
  if (typeof window === "undefined") return;

  // Сменили проект или источник (ушли из монитора в редактор) — очередь больше не нужна.
  const relevant = () => {
    const s = editorStore().getState();
    return s.currentProject?.id === projectId && s.sceneSource === source;
  };
  const run = () => {
    if (!relevant()) return;
    const pinned = readPinnedTabs(projectId).pins.map(p => p.id);
    const ids = [...new Set([...pinned, ...list.map(s => s.id)])]
      .filter(id => list.some(s => s.id === id));
    void prefetchScenes(projectId, ids, relevant, source);
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, {timeout: 2000});
  } else {
    setTimeout(run, 500);
  }
};

/**
 * Время перехода на схему — только в разработке: чтобы было видно, куда уходят секунды
 * (сеть, распаковка или отрисовка холста). Отрисовку меряем до второго кадра — первый
 * лишь планирует рендер Konva.
 */
export const logSceneTiming = (sceneId: number, source: string, startedAt: number, applyAt: number) => {
  if (process.env.NODE_ENV === "production" || typeof requestAnimationFrame === "undefined") return;
  const appliedAt = performance.now();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    console.info(
      `[scene] ${sceneId} (${source}): загрузка ${Math.round(applyAt - startedAt)} мс, `
      + `распаковка ${Math.round(appliedAt - applyAt)} мс, отрисовка ${Math.round(performance.now() - appliedAt)} мс`,
    );
  }));
};

/**
 * Показывает, какие чужие правки сервер подмешал в наше сохранение.
 *
 * Не блокирующим окном, но и не молча: инженер не должен обнаружить чужую работу в
 * своей сцене случайно. Тост живёт дольше обычного — это единственное место, где о
 * подмешанном вообще сообщается.
 *
 * Пустой `changes` — НЕ повод промолчать. Так бывает, когда мы и другой пользователь
 * сделали одну и ту же правку: подмешивать нечего, но база всё равно была устаревшей и
 * сохранение легло поверх чужой версии (§2 контракта, «Блок merged приходит всегда»).
 * Об этом сообщаем по `base_version`/`merged_with_version` — коротко, без списка.
 */
export const reportMergedChanges = (merged: MergeReport) => {
  const changes = Array.isArray(merged?.changes) ? merged.changes : [];

  if (!changes.length) {
    toast.info("Сохранено поверх чужой версии", {
      description:
        `Вы правили версию ${merged?.base_version ?? "—"}, ` +
        `на сервере уже была ${merged?.merged_with_version ?? "—"}. ` +
        `Расхождений не нашлось — подмешивать было нечего.`,
      duration: 8_000,
    });
    return;
  }

  const authors = Array.from(new Set(changes.map(c => c.user_name).filter(Boolean)));
  const shown = changes.slice(0, 3).map(c => c.path).filter(Boolean);
  const rest = changes.length - shown.length;

  toast.info("Сохранено. В вашу сцену добавлены чужие изменения", {
    description:
      `${authors.length ? `Автор(ы): ${authors.join(", ")}. ` : ""}` +
      `${shown.join("; ")}${rest > 0 ? ` и ещё ${rest}` : ""}`,
    duration: 12_000,
  });
};

/** Сколько версий тянем за раз. Автосейв раз в 10 минут — это ~48 версий в день на сцену,
 *  поэтому страница ощутимо больше «десятка последних». Потолок контракта — 500. */
export const VERSIONS_PAGE_SIZE = 50;

/**
 * Входит в режим просмотра старой версии: живое состояние откладывается, на холст
 * кладётся содержимое версии.
 *
 * История undo на это время ставится на паузу — версия попала на холст не действием
 * пользователя, и Ctrl+Z не должен «отменять» её появление, смешивая два состояния.
 * Повторный вход из уже открытого просмотра стеш не перезаписывает: иначе, полистав
 * версии, пользователь потерял бы свои несохранённые правки.
 */
export const enterVersionPreview = (
  doc: Record<string, unknown> | null,
  scene: SceneType,
  preview: VersionPreview,
) => {
  const state = editorStore().getState();

  if (!state.versionPreview) {
    editorSession.versionPreviewStash = {
      elements: state.elements,
      selectedIds: state.selectedIds,
      activeGroupKey: state.activeGroupKey,
      currentComponentStateByElementKey: state.currentComponentStateByElementKey,
      isDirty: state.isDirty,
      savedSnapshot: editorSession.savedElementsSnapshot,
    };
    editorStore().temporal.getState().pause();
  }

  // Форму документа разбирает общий хелпер: у обычного GET и `versions/{n}` это
  // `children`, у конверта восстановления — вложенный документ внутри `components`.
  applyServerComponents(rootComponentsOf(doc), scene);
  // Просмотр — не правка: без этого подписчик сравнил бы содержимое версии со снимком
  // текущей сцены и зажёг «есть несохранённые изменения» посреди чтения истории.
  markSceneSaved(false);
  editorStore().setState({versionPreview: preview});
};

/**
 * Гасит режим просмотра при смене документа — БЕЗ возврата отложенных правок.
 *
 * Правки в стеше принадлежали прошлой сцене: вернуть их в новую значит перенести
 * туда чужие элементы (с чужим parentKey и id прошлой сцены), то есть ровно то, от
 * чего защищает `temporal.clear()` на границе сцены. Поэтому здесь стеш отбрасывается.
 *
 * Проверка на активный просмотр обязательна: без неё `resume()` снял бы паузу
 * истории, которую поставил кто-то другой (перезагрузка сцены внутри exportScene
 * идёт как раз под `pause()`), и подмена elements стала бы шагом undo.
 */
export const discardVersionPreview = () => {
  if (!editorStore().getState().versionPreview) return;

  editorSession.versionPreviewStash = null;
  editorStore().setState({versionPreview: null});
  editorStore().temporal.getState().resume();
};

/**
 * Есть ли несохранённая работа — с учётом правок, отложенных на время просмотра версии.
 *
 * `isDirty` в режиме просмотра описывает ВЕРСИЮ на холсте, а она заведомо «чистая»
 * (см. enterVersionPreview). Реальные правки пользователя в этот момент лежат в стеше,
 * и без этой поправки закрытие вкладки во время просмотра истории не показало бы
 * предупреждение — молча потеряв работу, которая никуда не делась.
 */
export const hasUnsavedWork = (): boolean => {
  const {isDirty, versionPreview, sceneSource} = editorStore().getState();
  // В мониторе на холсте выпуск; правки инженера лежат в стеше черновика.
  if (sceneSource === "release") return editorSession.draftStash?.isDirty ?? false;
  return versionPreview ? (editorSession.versionPreviewStash?.isDirty ?? false) : isDirty;
};

/**
 * Переименование свойства на сервере — единственный оставшийся точечный запрос.
 *
 * Заведён ради рецептов: их значения ключевались ИМЕНЕМ строки, и перенести их на новое
 * имя мог только `PUT /api/editor/properties/{id}` (через наш прокси `/api/editor/tags/{id}`).
 * С 09.09.2026 рецепт — процедура над ТЕГАМИ, о свойствах компонента он не знает, и той
 * причины не осталось. Запрос сохранён: чем ещё занят этот эндпоинт, с фронта не видно.
 *
 * `ok: false` — сервер отказал: тогда локальное переименование не применяем, иначе имя
 * разъедется с тем, что знает бэкенд.
 *
 * Правка свойства записывает на сервере НОВУЮ ВЕРСИЮ сцены и возвращает её номер
 * (`version_no`, scada-r9lr). Раньше тело выбрасывалось, и сцена на сервере уходила на
 * N+1, пока стор считал её N: ручное сохранение шло через лишнее слияние, а
 * автосохранение получало 409. Что с номером делать — решает adoptPropertyEditVersion.
 */
export const renamePropertyOnServer = async (
  propertyId: number,
  payload: PropertyCreateRequestDto,
): Promise<{ok: false} | {ok: true; versionNo: number | null}> => {
  try {
    const res = await fetch(`/api/editor/tags/${propertyId}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(parseBackendErrorMessage(res.status, text));
    }
    const body = await res.json().catch(() => null);
    return {ok: true, versionNo: typeof body?.version_no === "number" ? body.version_no : null};
  } catch (err) {
    console.error(err);
    toast.error(getErrorMessage(err, "Не удалось переименовать свойство"));
    return {ok: false};
  }
};

/**
 * Номер версии сцены после точечной правки свойства на сервере.
 *
 * Номер из ответа — база только если он продолжает НАШУ: равен `sceneVersion` (сервер
 * ничего не записал, содержимое не изменилось) или больше ровно на один (записал нашу
 * правку). Любой другой номер значит, что между нашей загрузкой и правкой сцену сохранил
 * кто-то ещё. Принять его базой — значит, что следующее сохранение уйдёт в обход слияния
 * и молча затрёт чужую работу. Поэтому база остаётся прежней, а расхождение показываем
 * той же плашкой, что и 409 автосохранения: ручное сохранение сведёт правки.
 *
 * Документ на сервере изменился при любом исходе, так что запись кэша сцен сбрасываем.
 * Пока летел запрос, могли открыть другую схему (или заменить документ) — тогда номер
 * относится не к ней и в стор не пишется.
 */
export const adoptPropertyEditVersion = (
  projectId: number | undefined,
  sceneId: number | string | undefined,
  generation: number,
  versionNo: number | null,
) => {
  if (projectId != null && sceneId != null) dropScene(projectId, sceneId);

  const s = editorStore().getState();
  if (editorSession.documentGeneration !== generation || s.scene?.id !== sceneId) return;
  if (versionNo == null) return;

  const base = s.sceneVersion;
  // Базы нет (номер так и не узнали) — сверять не с чем, оставляем как было.
  if (base == null) return;

  if (versionNo === base || versionNo === base + 1) {
    editorStore().setState({sceneVersion: versionNo});
  } else {
    editorStore().setState({staleBaseVersion: versionNo});
  }
};

/**
 * Свойства, которые бэкенд не примет: у него `name` и `value_type` обязательны.
 *
 * Проверка появилась вместе с переездом свойств в тело сцены: раньше отказ приходил на
 * собственный запрос свойства и дальше него не шёл, а теперь одно незаполненное свойство
 * не даёт сохранить всю схему. Сообщение бэкенда называет только имя свойства, поэтому
 * возвращаем пару «элемент → свойство».
 */
export const invalidProperties = (elements: DiagramElement[]): string[] => {
  const problems: string[] = [];
  for (const el of elements) {
    for (const p of el.properties ?? []) {
      const name = p.name?.trim();
      const where = el.label?.trim() || el.type;
      if (!name) problems.push(`«${where}»: свойство без названия`);
      else if (!p.value_type?.trim()) problems.push(`«${where}» → «${name}»: не указан тип значения`);
    }
  }
  return problems;
};

/** Фиксирует текущее состояние как сохранённое: снимает флаг «грязно». */
export const markSceneSaved = (persisted: boolean) => {
  editorSession.savedElementsSnapshot = editorStore().getState().elements;
  editorStore().setState({
    isDirty: false,
    ...(persisted ? {lastSavedAt: Date.now()} : {}),
  });
};

/**
 * Переносит присвоенные сервером `id` во все снимки истории undo/redo (по `key`).
 *
 * После сохранения история сцены сохраняется (см. `loadScene({keepHistory})`), поэтому
 * откатиться можно и «за» точку сейва. Снимки, снятые до сохранения, помнят новые
 * элементы с `id: null`, а бэкенд апсертит по `id` — повторное сохранение после такого
 * отката создало бы ДУБЛИ. Проставляем актуальные id, чтобы любой снимок оставался
 * безопасным для сохранения.
 */
export const rebaseHistoryIds = (current: DiagramElement[]) => {
  const idByKey = new Map(current.map(el => [el.key, el.id]));

  const patch = (snapshot: Partial<{elements: DiagramElement[]}>) => {
    if (!snapshot.elements) return snapshot;
    let changed = false;
    const elements = snapshot.elements.map(el => {
      const serverId = idByKey.get(el.key);
      if (el.id == null && serverId != null) {
        changed = true;
        return {...el, id: serverId} as DiagramElement;
      }
      return el;
    });
    // Ссылку массива меняем только при реальной правке — `equality` стора сравнивает
    // именно её, и лишние новые массивы засорили бы стек дубликатами.
    return changed ? {...snapshot, elements} : snapshot;
  };

  const {pastStates, futureStates} = editorStore().temporal.getState();
  editorStore().temporal.setState({
    pastStates: pastStates.map(patch),
    futureStates: futureStates.map(patch),
  });
};
