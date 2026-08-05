import {snap} from "@/lib/utils";
import {create} from "zustand/react";
import {GroupElement, DiagramElement, ElementType, SceneType} from "@/types/editorElement.type";
import {temporal} from "zundo";
import {
  elementToGroupLocal,
  GROUP_PADDING,
  layoutGroupFromBounds,
  snapshotBounds,
  unionBounds,
  resolveParentAbsolute,
} from "@/lib/groupLayout";
import {buildComponentTree} from "@/lib/buildComponentTree";
import {elementRegistry} from "@/constants/propertiesPanel";
import transformElements from "@/lib/transformElements";
import {toast} from "sonner";
import {PropertyCreateDto, PropertyCreateRequestDto} from "@/types/tags.types";
import {TagBinding} from "@/types/binding.types";
import {createUuid} from "@/lib/createUuid";
import {normalizeProjectList, toEditorProject, type EditorProject} from "@/lib/pickProjectsFromComponents";
import {getElementBoundsRendered} from "@/lib/getElementBounds";

export type {EditorProject};

type EditorState = {
  scene: SceneType | null;
  sceneList: {id: number; name: string}[];
  currentProject: EditorProject | null;
  projectList: EditorProject[];
  loadSceneList: (projectId: number) => Promise<{id: number; name: string}[] | void>;
  loadProjectList: () => Promise<EditorProject[] | void>;
  createProject: (name: string) => Promise<EditorProject | void>;
  setCurrentProject: (project: EditorProject | null) => void;
  elements: DiagramElement[];
  selectedId: string | null;
  selectedIds: string[];
  activeGroupKey: string | null;
  enterGroup: (key: string) => void;
  exitGroup: () => void;
  /**
   * Ячейка таблицы, сфокусированная в панели свойств (для показа cell-специфичных
   * полей). Транзиентно, как selectedIds/activeGroupKey — не в elements, вне undo.
   */
  selectedTableCell: {elementKey: string; row: number; col: number} | null;
  selectTableCell: (elementKey: string, row: number, col: number) => void;
  clearTableCellSelection: () => void;
  currentComponentStateByElementKey: Record<string, string>;
  setCurrentComponentStateId: (elementKey: string, componentState: string) => void;
  clearCurrentComponentStateId: (elementKey: string) => void;

  /**
   * Рантайм-оверрайды визуальных свойств (setProp из биндингов монитора).
   * Живут ПОВЕРХ state.overrides в getRenderedElement и никогда не пишутся
   * в elements — не попадают ни в undo, ни в автосейв.
   */
  runtimeOverridesByElementKey: Record<string, Record<string, unknown>>;
  /**
   * Ключи элементов, привязанных к тегу с quality != GOOD (или ещё не получавших
   * ни одного сообщения — холодный старт). Рисуется оверлеем «нет данных» поверх
   * готовой сцены (NoDataOverlay), не завязано на elements/undo/автосейв —
   * TAG_CONTRACT_CHANGES.md B2/B4.
   */
  noDataElementKeys: Set<string>;
  /**
   * Применяет батч рантайм-изменений одним set(): переключения состояний
   * (по ИМЕНИ, с каскадом на поддерево) + патчи визуальных свойств + набор
   * элементов «нет данных». Если фактических изменений нет — set() не вызывается вовсе.
   */
  applyRuntimeBatch: (batch: {
    stateNameByKey?: Record<string, string>;
    propsByKey?: Record<string, Record<string, unknown>>;
    noDataKeys?: Set<string>;
  }) => void;
  /** Сброс всех рантайм-карт (выход из монитора). */
  clearRuntime: () => void;
  clipboard: DiagramElement[] | null;
  canvasRect: DOMRect | null;
  connecting: {
    fromNode: string;
    fromPort: string;
    mouseX: number;
    mouseY: number;
  } | null;

  camera: {x: number, y: number, zoom: number};
  setCameraPan: (dx: number, dy: number) => void;
  setCameraZoom: (newZoom: number) => void;
  setCamera: (x: number, y: number, zoom: number) => void;

  /**
   * «Вооружённый» инструмент палитры: клик по элементу палитры сохраняет сюда его
   * тип/шаблон, следующий клик по холсту ставит элемент в эту точку и сбрасывает
   * pendingPlacement в null (постановка по одному). id — id элемента палитры (для
   * подсветки именно его и toggle). Не попадает в историю undo (не меняет elements).
   */
  pendingPlacement: { id: number; type: ElementType; template?: DiagramElement[] } | null;
  setPendingPlacement: (p: { id: number; type: ElementType; template?: DiagramElement[] } | null) => void;

  /** Сдвиг всех верхнеуровневых выделенных на dx/dy (стрелки, мульти-drag). excludeKey — уже сдвинут сам. */
  moveSelectedBy: (dx: number, dy: number, excludeKey?: string) => void;
  /** Дубликат выделения со смещением (Ctrl+D); клоны попадают в корень сцены, как при вставке. */
  duplicateSelected: () => void;
  /** Выделить все элементы текущего скоупа (активная группа или корень сцены), Ctrl+A. */
  selectAllInScope: () => void;
  bringToFront: (key: string) => void;
  sendToBack: (key: string) => void;
  /** Выравнивание верхнеуровневых выделенных (≥2) по краю/центру общей рамки. */
  alignSelected: (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;
  /** Распределение верхнеуровневых выделенных (≥3) с равными зазорами по оси. */
  distributeSelected: (axis: 'h' | 'v') => void;

  setCanvasRect: (rect: DOMRect) => void;
  updateElement: (id: string, data: Partial<DiagramElement>) => void;
  updateElementVisual: (id: string, data: Partial<DiagramElement>) => void;
  /** Мульти-версия updateElementVisual: один шаг undo для всех ключей. */
  updateElementsVisual: (keys: string[], data: Partial<DiagramElement>) => void;
  select: (id: string | null) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  addComponentStateToSubtree: (elementKey: string, stateName: string) => string | null;
  removeComponentStateFromSubtree: (elementKey: string, stateName: string) => void;
  addElementAt: (x: number, y: number, type: ElementType, extraProps?: Record<string, unknown>) => void;
  addTags: (payload: PropertyCreateRequestDto) => Promise<void>;
  editProperty: (propertyId: number, payload: PropertyCreateRequestDto) => Promise<void>;
  /** CRUD биндингов (JS-скрипты монитора) — design-time правки, попадают в undo. */
  addBinding: (elementKey: string, binding: TagBinding) => void;
  updateBinding: (elementKey: string, bindingId: string, patch: Partial<Omit<TagBinding, "v" | "id">>) => void;
  removeBinding: (elementKey: string, bindingId: string) => void;
  addTemplate: (screenX: number, screenY: number, template: DiagramElement[]) => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
  exportScene: (opts?: { silent?: boolean; keepView?: boolean }) => Promise<boolean>;
  importElementsFromJson: (rawElements: Record<string, unknown>[]) => void;
  loadScene: (id: number) => Promise<void>;
  createScene: (name?: string) => Promise<{id: number; name: string} | void>;
  deleteScene: (id: number) => Promise<void>;

  groupSelected: () => void;
  ungroupSelected: () => void;
  createComponentFromGroup: (groupKey: string, name?: string) => void;
  disassembleComponent: (componentKey: string) => void;
  moveElementToGroup: (elementKey: string, targetGroupKey: string) => void;

  // removeElements: (ids: string[]) => void;
}

const isGroup = (el: DiagramElement) => el.type === "group";

/**
 * Сдвигает все позиционные поля (x, y, x1, y1, x2, y2) объекта на dx/dy.
 * Позиция элемента может лежать как в базовых полях, так и в overrides состояния
 * (перемещённые листья), а у линий — в x1/y1/x2/y2. Поэтому сдвигаем везде, где есть.
 */
const shiftPositionKeys = (obj: Record<string, unknown>, dx: number, dy: number): Record<string, unknown> => {
  const o = {...obj};
  for (const k of ['x', 'x1', 'x2'] as const) {
    if (typeof o[k] === 'number') o[k] = (o[k] as number) + dx;
  }
  for (const k of ['y', 'y1', 'y2'] as const) {
    if (typeof o[k] === 'number') o[k] = (o[k] as number) + dy;
  }
  return o;
};

/** Сдвигает элемент на dx/dy: базовые поля + позиционные ключи в overrides всех состояний. */
const shiftElementPositions = (el: DiagramElement, dx: number, dy: number): DiagramElement => {
  const shifted = shiftPositionKeys(el as unknown as Record<string, unknown>, dx, dy) as unknown as DiagramElement;
  shifted.states = (el.states ?? []).map(s => ({
    ...s,
    overrides: shiftPositionKeys(s.overrides ?? {}, dx, dy),
  }));
  return shifted;
};

/**
 * Верхнеуровневые выделенные: без выделенного предка (элемент с выделенным
 * предком едет вместе с ним, отдельный сдвиг задвоил бы перемещение).
 */
const topLevelSelectedKeys = (selectedIds: string[], elements: DiagramElement[]): string[] => {
  const byKey = new Map(elements.map(el => [el.key, el] as const));
  const selectedSet = new Set(selectedIds);
  const hasSelectedAncestor = (el: DiagramElement): boolean => {
    let pk = el.parentKey;
    while (pk) {
      if (selectedSet.has(pk)) return true;
      pk = byKey.get(pk)?.parentKey ?? null;
    }
    return false;
  };
  return selectedIds.filter(k => {
    const el = byKey.get(k);
    return !!el && !hasSelectedAncestor(el);
  });
};

/** Применяет индивидуальные сдвиги к элементам и пересчитывает рамки их предков. */
const applyShifts = (
  elements: DiagramElement[],
  shifts: Map<string, {dx: number; dy: number}>,
  sceneId: number | null | undefined,
): DiagramElement[] => {
  let next = elements.map(el => {
    const s = shifts.get(el.key);
    return s && (s.dx || s.dy) ? shiftElementPositions(el, s.dx, s.dy) : el;
  });
  for (const k of shifts.keys()) {
    next = recomputeAncestorBounds(next, k, sceneId);
  }
  return next;
};

/**
 * Клонирует набор элементов (с потомками) с ремапом ключей и смещением корней
 * вправо-вниз. Корни клона реparent'ятся в корень сцены. Общая база для
 * вставки (Ctrl+V) и дублирования (Ctrl+D).
 */
const cloneElementsWithOffset = (
  source: DiagramElement[],
  scene: SceneType | null,
  offset = 60,
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
      scripts: Array.isArray(el.scripts) ? el.scripts : [],
      bindings: Array.isArray(el.bindings) ? el.bindings : [],
    } as DiagramElement;

    // Смещаем только корневые (дочерние двигаются вместе с родителем);
    // сдвигаются все позиционные поля — см. shiftElementPositions.
    if (!isRoot) return remapped;

    return shiftElementPositions(remapped, offset, offset);
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
  const byKey = new Map(elements.map(el => [el.key, el] as const));
  const children: string[] = [];
  const composition: string[] = [];
  for (const k of memberKeys) {
    const m = byKey.get(k);
    if (!m) continue;
    if (isLeafPrimitive(m)) composition.push(k);
    else children.push(k);
  }
  return elements.map(el =>
    el.key === containerKey ? ({...el, children, composition} as DiagramElement) : el,
  );
};

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
const sceneBelongsToCurrentProject = (
  scene: SceneType | null,
  currentProject: {id: number; name: string} | null,
): boolean => {
  if (!currentProject) return false;
  if (!scene) return false;
  if (scene.project_id == null) return true;
  return scene.project_id === currentProject.id;
};

/**
 * После перемещения/ресайза элемента пересчитывает x/y/w/h всех групп-предков
 * снизу вверх, чтобы рамки групп всегда облегали своё содержимое.
 * Компенсирует сдвиг origin группы в локальных координатах детей, чтобы не
 * было визуального прыжка при расширении рамки в сторону верхнего-левого угла.
 */
const RECOMPUTE_EXTRA_PADDING = 20; // extra on top of GROUP_PADDING

const recomputeAncestorBounds = (
  elements: DiagramElement[],
  movedKey: string,
  sceneId: number | null | undefined,
): DiagramElement[] => {
  let result = elements;
  const sceneIdStr = String(sceneId ?? "");
  const totalPadding = GROUP_PADDING + RECOMPUTE_EXTRA_PADDING;

  // Индекс key→element: функция сидит на горячем пути drag'а, линейные find'ы
  // в циклах давали O(n²) на каждый сдвиг. Пересобираем после каждого map ниже.
  let byKey = new Map(result.map(el => [el.key, el] as const));

  // Собираем цепочку групп-предков снизу вверх
  const ancestorGroupKeys: string[] = [];
  const movedEl = byKey.get(movedKey);
  let parentKey = movedEl?.parentKey ?? null;
  while (parentKey && parentKey !== sceneIdStr) {
    const parent = byKey.get(parentKey);
    if (!parent || parent.type !== "group") break;
    ancestorGroupKeys.push(parent.key);
    parentKey = parent.parentKey ?? null;
  }

  // Пересчитываем от самого глубокого предка к корневому
  for (const groupKey of ancestorGroupKeys) {
    const group = byKey.get(groupKey);
    if (!group || group.type !== "group") continue;

    const childKeySet = new Set([...group.children, ...(group.composition ?? [])]);
    if (!childKeySet.size) continue;

    // Считаем абсолютные границы всех детей в актуальном state (result уже обновлён)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const childKey of childKeySet) {
      const child = byKey.get(childKey);
      if (!child) continue;
      const b = getElementBoundsRendered(child, result);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }

    if (!isFinite(minX)) continue;

    const parentAbs = resolveParentAbsolute(group.parentKey, result, sceneId);

    const newGroupX = minX - totalPadding - parentAbs.x;
    const newGroupY = minY - totalPadding - parentAbs.y;
    const dx = newGroupX - group.x;
    const dy = newGroupY - group.y;

    result = result.map(el => {
      if (el.key === groupKey) {
        return {
          ...el,
          x: newGroupX,
          y: newGroupY,
          w: maxX - minX + totalPadding * 2,
          h: maxY - minY + totalPadding * 2,
        } as DiagramElement;
      }

      // Компенсируем сдвиг origin группы в локальных координатах прямых детей,
      // чтобы их абсолютная позиция на холсте не изменилась.
      if (childKeySet.has(el.key) && (dx !== 0 || dy !== 0)) {
        const leafEl = el as import("@/types/editorElement.type").LeafElement;
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

        return {
          ...el,
          x: el.x - dx,
          y: el.y - dy,
          ...(leafEl.x1 !== undefined ? {x1: leafEl.x1 - dx} : {}),
          ...(leafEl.y1 !== undefined ? {y1: leafEl.y1 - dy} : {}),
          ...(leafEl.x2 !== undefined ? {x2: leafEl.x2 - dx} : {}),
          ...(leafEl.y2 !== undefined ? {y2: leafEl.y2 - dy} : {}),
          states: adjustedStates,
        } as DiagramElement;
      }

      return el;
    });

    // result пересобран — обновляем индекс для следующего предка в цепочке.
    byKey = new Map(result.map(el => [el.key, el] as const));
  }

  return result;
};

const getDescendantKeys = (rootKey: string, elements: DiagramElement[]) => {
  const result = new Set<string>();
  const queue = [rootKey];
  const byKey = new Map(elements.map(el => [el.key, el] as const));

  while (queue.length) {
    const currentKey = queue.shift()!;
    const current = byKey.get(currentKey);

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

  const byKey = new Map(elements.map(el => [el.key, el] as const));
  for (const childKey of getDescendantKeys(rootKey, elements)) {
    const child = byKey.get(childKey);
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

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/**
 * Бэкенд отдаёт ошибки JSON-телом `{status, message, error, timestamp}`
 * (Spring `ErrorResponse`). Достаём `message` — иначе тост показывает
 * пользователю сырой JSON-блоб, который легко принять за «ничего не произошло».
 */
const parseBackendErrorMessage = (status: number, text: string): string => {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === "string" && parsed.message) return parsed.message;
  } catch {
    // тело не JSON — покажем как есть (обрезано)
  }
  return `Ошибка ${status}${text ? `: ${text.slice(0, 200)}` : ""}`;
};

/**
 * Единый «замок» на ВСЕ сохранения сцены (ручное + авто + повторные клики).
 *
 * Бэкенд апсертит по `id` (вариант А), а новые элементы уходят с `id = null`.
 * Пока первое сохранение не завершилось перезагрузкой (`loadScene` подтягивает
 * присвоенные сервером id), второй параллельный POST снова отправит `id = null`
 * и сервер создаст ДУБЛИ. Поэтому сериализуем сохранения: пока идёт одно —
 * второе не стартует, а reload после каждого сейва гарантирует, что следующий
 * POST пойдёт уже с id (update, а не insert).
 */
let saveInFlight: Promise<boolean> | null = null;

export const useEditorStore = create<EditorState>()(temporal(
    (set, get) => ({
      scene: null,
      sceneList: [],
      currentProject: null,
      projectList: [],
      elements: [],
      selectedId: null,
      selectedIds: [],
      activeGroupKey: null,
      selectedTableCell: null,
      currentComponentStateByElementKey: {},
      runtimeOverridesByElementKey: {},
      noDataElementKeys: new Set(),
      clipboard: null,
      canvasRect: null,
      connecting: null,

      camera: {x: 0, y: 0, zoom: 1},
      setCameraPan: (dx, dy) => {
        set(state => ({
          camera: {...state.camera, x: state.camera.x + dx, y: state.camera.y + dy}
        }))
      },
      setCameraZoom: (newZoom) => {
        set(state => ({
          camera: {...state.camera, zoom: newZoom}
        }))
      },
      setCamera: (x, y, zoom) => set({camera: {x, y, zoom}}),

      pendingPlacement: null,
      setPendingPlacement: (p) => set({pendingPlacement: p}),
      moveSelectedBy: (dx, dy, excludeKey) => {
        if (!dx && !dy) return;
        const {selectedIds, elements, scene} = get();
        if (!selectedIds.length) return;

        const keysToMove = topLevelSelectedKeys(selectedIds, elements).filter(k => k !== excludeKey);
        if (!keysToMove.length) return;

        const shifts = new Map(keysToMove.map(k => [k, {dx, dy}] as const));
        set({elements: applyShifts(elements, shifts, scene?.id)});
      },
      alignSelected: (mode) => {
        const {selectedIds, elements, scene} = get();
        const keys = topLevelSelectedKeys(selectedIds, elements);
        if (keys.length < 2) return;

        const byKey = new Map(elements.map(el => [el.key, el] as const));
        const boundsByKey = new Map(keys.map(k => [k, getElementBoundsRendered(byKey.get(k)!, elements)] as const));
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

        const byKey = new Map(elements.map(el => [el.key, el] as const));
        const items = keys
          .map(k => ({key: k, b: getElementBoundsRendered(byKey.get(k)!, elements)}))
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
      selectAllInScope: () => {
        const {elements, scene, activeGroupKey} = get();
        const scopeKey = activeGroupKey ?? String(scene?.id ?? "");
        const keys = elements.filter(el => String(el.parentKey) === scopeKey).map(el => el.key);
        if (keys.length) set({selectedIds: keys, selectedTableCell: null});
      },
      bringToFront: (key) => {
        const {elements} = get();
        const el = elements.find(e => e.key === key);
        if (!el) return;
        // Порядок отрисовки: верхний уровень — порядок плоского массива;
        // внутри контейнера — порядок composition/children родителя. Двигаем в обоих местах.
        const moveToEnd = (arr: string[]) => arr.includes(key) ? [...arr.filter(k => k !== key), key] : arr;
        const next = [...elements.filter(e => e.key !== key), el].map(e =>
          e.key === el.parentKey
            ? {...e, children: moveToEnd(e.children), composition: moveToEnd(e.composition ?? [])} as DiagramElement
            : e,
        );
        set({elements: next});
      },
      sendToBack: (key) => {
        const {elements} = get();
        const el = elements.find(e => e.key === key);
        if (!el) return;
        const moveToStart = (arr: string[]) => arr.includes(key) ? [key, ...arr.filter(k => k !== key)] : arr;
        const next = [el, ...elements.filter(e => e.key !== key)].map(e =>
          e.key === el.parentKey
            ? {...e, children: moveToStart(e.children), composition: moveToStart(e.composition ?? [])} as DiagramElement
            : e,
        );
        set({elements: next});
      },

      setCanvasRect: (rect) => set({canvasRect: rect}),
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
          const byKey = new Map(nextElements.map(el => [el.key, el] as const));
          const nextCurrent = {...state.currentComponentStateByElementKey};
          let currentChanged = false;
          for (const [key, stateId] of Object.entries(nextCurrent)) {
            if (!removedStateIds.has(stateId)) continue;
            const el = byKey.get(key);
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
          const byKey = new Map(state.elements.map(el => [el.key, el] as const));
          const nextMap = {...state.currentComponentStateByElementKey};
          for (const [elementKey, stateName] of Object.entries(stateNameByKey)) {
            const el = byKey.get(elementKey);
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

        // 2) Патчи визуальных свойств — только в рантайм-карту, elements не трогаем.
        if (propsByKey && Object.keys(propsByKey).length) {
          let changed = false;
          const nextOverrides = {...state.runtimeOverridesByElementKey};
          for (const [elementKey, props] of Object.entries(propsByKey)) {
            const prev = nextOverrides[elementKey] ?? {};
            const merged = {...prev, ...props};
            if (Object.keys(props).some(k => !Object.is(prev[k], props[k]))) {
              nextOverrides[elementKey] = merged;
              changed = true;
            }
          }
          if (changed) patch.runtimeOverridesByElementKey = nextOverrides;
        }

        // 3) Набор «нет данных» (B2/B4) — движок уже присылает только изменившийся
        // набор (diff внутри useRuntimeEngine), здесь достаточно просто заменить.
        if (noDataKeys) patch.noDataElementKeys = noDataKeys;

        // Ничего фактически не изменилось — не дёргаем ни стор, ни рендер.
        if (Object.keys(patch).length) set(patch);
      },
      clearRuntime: () => set({
        runtimeOverridesByElementKey: {},
        currentComponentStateByElementKey: {},
        noDataElementKeys: new Set(),
      }),
      updateElementVisual: (key, updates) => get().updateElementsVisual([key], updates),
      // Мульти-версия: один set() (= один шаг undo) для всех ключей.
      updateElementsVisual: (keys, updates) => {
         if (!keys.length) return;
         const { currentComponentStateByElementKey } = get();
         const keySet = new Set(keys);

         set(state => {
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
               return { ...el, ...validatedUpdates } as DiagramElement;
             }

             const currentComponentStateId = currentComponentStateByElementKey[el.key]
               ?? el.states.find(s => s.isDefault)?.id
               ?? el.states[0]?.id;

             if (!currentComponentStateId) {
               return {
                 ...el,
                 ...validatedUpdates,
               } as DiagramElement;
             }

             return {
               ...el,
               states: el.states.map(s =>
                 s.id === currentComponentStateId
                   ? {
                     ...s,
                     overrides: {
                       ...s.overrides,
                       ...validatedUpdates,
                     },
                   }
                   : s
               ),
             } as DiagramElement;
           });

           // Если изменились позиционные поля — пересчитываем рамки групп-предков
           const POSITIONAL_KEYS = new Set(["x", "y", "w", "h", "x1", "y1", "x2", "y2", "radius", "points"]);
           const hasPositionalChange = Object.keys(updates).some(k => POSITIONAL_KEYS.has(k));
           if (hasPositionalChange) {
             let result = updatedElements;
             for (const key of keys) {
               result = recomputeAncestorBounds(result, key, state.scene?.id);
             }
             return { elements: result };
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
      select: (id) => set({selectedIds: id ? [id] : [], selectedTableCell: null}),
      selectMultiple: (ids) => set({selectedIds: [...ids], selectedTableCell: null}),
      clearSelection: () => set({selectedIds: [], selectedTableCell: null}),
      enterGroup: (key) => set({activeGroupKey: key, selectedIds: [], selectedTableCell: null}),
      selectTableCell: (elementKey, row, col) => set({selectedTableCell: {elementKey, row, col}}),
      clearTableCellSelection: () => set({selectedTableCell: null}),
      exitGroup: () => set(state => {
        if (!state.activeGroupKey) return {};
        const group = state.elements.find(el => el.key === state.activeGroupKey);
        const parentKey = group?.parentKey;
        const parentIsGroup = parentKey
          ? state.elements.find(el => el.key === parentKey)?.type === 'group'
          : false;
        return {
          activeGroupKey: parentIsGroup ? parentKey! : null,
          selectedIds: [],
          selectedTableCell: null,
        };
      }),
      addTemplate: (screenX, screenY, template) => {
        const {scene, currentProject} = get();

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя добавить шаблон: сцена не принадлежит выбранному проекту");
          return;
        }

        const x = snap(screenX);
        const y = snap(screenY);

        const keyMap: Record<string, string> = {};
        template.forEach(el => {
          keyMap[el.key] = createUuid();
        });

        const root = template.find(el => el.type === "group") || template[0];

        const newElements = template.map(el => {
          // 1. Формируем базовый обновленный элемент (меняем только ключи и связи)
          const updatedElement = {
            ...el,
            id: null,
            key: keyMap[el.key],
            parentKey: el.parentKey ? (keyMap[el.parentKey] || el.parentKey) : null,
            children: el.children ? el.children.map(childKey => keyMap[childKey] || childKey) : undefined,
            composition: el.composition ? el.composition.map(k => keyMap[k] || k) : [],
            scripts: Array.isArray((el as DiagramElement).scripts) ? (el as DiagramElement).scripts : [],
            bindings: Array.isArray((el as DiagramElement).bindings) ? (el as DiagramElement).bindings : [],
            // Дочерние элементы шаблона ещё не сохранены на сервере,
            // поэтому parentId у них null — бэкенд проставит id при сохранении сцены.
            parentId: null,
          };

          // 2. Если это НАШ корневой элемент — задаем ему новые координаты на холсте
          //    и привязываем к текущей сцене (parentId = scene.id, parentKey = String(scene.id)).
          if (el.key === root.key) {
            updatedElement.x = x;
            updatedElement.y = y;
            updatedElement.parentKey = String(scene?.id);
            updatedElement.parentId = scene?.id ?? null;
          }

          return updatedElement as DiagramElement;
        });

        set(state => ({
          elements: [...state.elements, ...newElements],
        }));

      },
      importElementsFromJson: (rawElements) => {
        const {scene, currentProject} = get();

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя импортировать: сцена не принадлежит выбранному проекту");
          return;
        }

        const CANVAS_W = 5000;
        const CANVAS_H = 5000;

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
            properties:  Array.isArray(raw.properties) ? raw.properties : [],
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

        set(state => ({ elements: [...state.elements, ...imported] }));
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

          set(state => ({
            elements: [...state.elements, newElement]
          }))

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
          set(state => ({ elements: [...state.elements, newElement] }));
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
          set(state => ({ elements: [...state.elements, newElement] }));
          return;
        }

        if (type === 'button') {
          const newElement: DiagramElement = {
            id: null, key: createUuid(), type, composition,
            x, y, w: 120, h: 40,
            label: "Кнопка", color: "#3b82f6", textColor: "#ffffff",
            rx: 6, pressed: false, enabled: true, bg: "transparent",
            parentId: scene?.id || null, parentKey: String(scene?.id) || null,
            children: [], scripts: [], bindings: [], properties: [],
            states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
          };
          set(state => ({ elements: [...state.elements, newElement] }));
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
          set(state => ({ elements: [...state.elements, newElement] }));
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
          set(state => ({ elements: [...state.elements, newElement] }));
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
          set(state => ({ elements: [...state.elements, newElement] }));
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
          set(state => ({ elements: [...state.elements, newElement] }));
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
          set(state => ({ elements: [...state.elements, newElement] }));
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
          set(state => ({ elements: [...state.elements, newElement] }));
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

        set(state => ({
          elements: [...state.elements, newElement]
        }))
      },
      addTags: async (payload: PropertyCreateRequestDto) => {
        try {
          const res = await fetch(`/api/editor/tags`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errorText = await res.text().catch(() => "Неизвестная ошибка");
            throw new Error(`Не удалось добавить свойство: ${errorText}`);
          }

          const created: PropertyCreateDto = await res.json();
          // Некоторые бэкенды пока не round-trip'ят position на одиночном
          // REST-эндпоинте свойства (в отличие от bulk-сохранения компонента) —
          // подстраховываемся значением, которое сами отправили.
          const newProperty: PropertyCreateDto = {
            ...created,
            position: created.position ?? payload.position ?? null,
          };

          // Свойство уже создано на сервере — не пишем эту мутацию в историю undo,
          // иначе Ctrl+Z уберёт его только на клиенте (рассинхрон с бэкендом).
          const temporal = useEditorStore.temporal.getState();
          temporal.pause();
          set(state => ({
            elements: state.elements.map(el =>
              el.id === payload.component_id
                ? { ...el, properties: [...(el.properties || []), newProperty]} as DiagramElement
                : el
            )
          }));
          temporal.resume();
        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка при добавлении свойства"));
        }
      },
      editProperty: async (propertyId: number, payload: PropertyCreateRequestDto) => {
        const res = await fetch(`/api/editor/tags/${propertyId}`, {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => "Неизвестная ошибка");
          throw new Error(`Не удалось обновить свойство: ${errorText}`);
        }

        const updated: PropertyCreateDto = await res.json();
        // См. addTags — тот же fallback на случай, если бэкенд не round-trip'ит
        // position на одиночном REST-эндпоинте свойства.
        const updatedProperty: PropertyCreateDto = {
          ...updated,
          position: updated.position ?? payload.position ?? null,
        };

        // Серверная мутация — вне истории undo (см. addTags).
        const temporal = useEditorStore.temporal.getState();
        temporal.pause();
        set(state => ({
          elements: state.elements.map(el =>
            el.id === payload.component_id
              ? {
                  ...el,
                  properties: (el.properties || []).map(p =>
                    p.id === propertyId ? updatedProperty : p
                  )
                } as DiagramElement
              : el
          )
        }));
        temporal.resume();
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

        // Собираем только id, которые существуют (не null/undefined)
        const ids = elements
          .filter(el => idsToDelete.has(el.key))
          .map(el => el.id)
          .filter((id): id is number => id !== null && id !== undefined);

        // Снапшот для отката, если сервер не сможет удалить.
        const prevElements = elements;
        const prevStateMap = get().currentComponentStateByElementKey;

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

        for (const parentKey of parentKeysToClean) {
          const parent = nextElements.find(el => el.key === parentKey);
          if (!parent || parent.type !== "group") continue;
          const firstMember = [...(parent.children ?? []), ...(parent.composition ?? [])][0];
          if (firstMember) {
            nextElements = recomputeAncestorBounds(nextElements, firstMember, scene?.id);
          }
        }

        // Локально удаляем выделенные элементы (даже если у них не было id)
        set({
          elements: nextElements,
          selectedIds: [],
          selectedTableCell: null,
          currentComponentStateByElementKey: Object.fromEntries(
            Object.entries(prevStateMap).filter(([elementKey]) => !idsToDelete.has(elementKey))
          ),
          // Если удалили группу, внутри которой находились — выходим из неё.
          ...(activeGroupKey && idsToDelete.has(activeGroupKey) ? {activeGroupKey: null} : {}),
        });

        // Отправляем DELETE на сервер только для тех элементов, у которых есть id
        if (ids.length === 0) return;


        try {
          const res = await fetch(`/api/editor/components`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ids),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Ошибка ${res.status}: ${text}`);
          }
        } catch (err) {
          console.error('Ошибка при удалении:', err);
          // Откат: сервер не удалил — возвращаем элементы, иначе после автосейва
          // неудавшееся удаление станет «постоянным» (тихий рассинхрон клиент/сервер).
          set({elements: prevElements, currentComponentStateByElementKey: prevStateMap});
          toast.error('Не удалось удалить элементы на сервере. Изменения отменены.');
        }
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
        toast.success('Скопировано');
      },
      pasteSelectedElement: () => {
        const { clipboard, scene } = get();
        if (!clipboard || !clipboard.length) return;

        const {newElements, newRootKeys} = cloneElementsWithOffset(clipboard, scene);

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
        // Сериализуем все сохранения через общий замок (см. `saveInFlight`),
        // иначе два параллельных POST с id=null создадут дубли на сервере.
        // Автосейв не встаёт в очередь — просто пропускает тик (поймает
        // изменения на следующем).
        if (opts?.silent && saveInFlight) return false;
        // Ручное сохранение дожидается текущего сейва, чтобы затем сохранить
        // уже актуальное (и id-сверенное после reload) состояние. Между выходом
        // из цикла и присвоением замка ниже нет `await`, поэтому два вызова не
        // могут захватить его одновременно.
        while (saveInFlight) {
          await saveInFlight.catch(() => {});
        }

        const run = (async (): Promise<boolean> => {
          try {
            const {elements, scene, currentProject} = get();

            if (!sceneBelongsToCurrentProject(scene, currentProject)) {
              if (!opts?.silent) toast.error("Сцена не принадлежит выбранному проекту");
              return false;
            }

            const payload = buildComponentTree(elements, String(scene?.id));

            const res = await fetch("/api/editor/components", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error(parseBackendErrorMessage(res.status, text));
            }

            if (!opts?.silent) toast.success("Сохранено успешно!");

            if (scene?.id) {
              // loadScene заменяет elements серверными (уже с id) и сбрасывает
              // выделение/активную группу/состояния. При keepView (автосейв)
              // снимаем их до перезагрузки и восстанавливаем по ключам после —
              // чтобы автосейв не «дёргал» пользователя. Reload здесь обязателен:
              // он подтягивает присвоенные сервером id, без которых следующее
              // сохранение снова вставит дубли (вариант А).
              const prevSelected = opts?.keepView ? get().selectedIds : null;
              const prevActive = opts?.keepView ? get().activeGroupKey : null;
              const prevStates = opts?.keepView ? get().currentComponentStateByElementKey : null;

              await get().loadScene(scene.id);

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

            return true;
          } catch (err: unknown) {
            console.error(err);
            toast.error(getErrorMessage(err, opts?.silent ? "Автосохранение не удалось" : "Ошибка экспорта сцены"));
            return false;
          }
        })();

        saveInFlight = run;
        try {
          return await run;
        } finally {
          if (saveInFlight === run) saveInFlight = null;
        }
      },
      loadSceneList: async (projectId: number) => {
        try {
          const res = await fetch(`/api/editor/scene?project_id=${projectId}`);

          if (!res.ok) {
            throw new Error(await res.text().catch(() => "Ошибка загрузки списка сцен"));
          }

          const json = await res.json();
          const list = Array.isArray(json) ? json : [];
          set({sceneList: list});
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
            throw new Error(await res.text().catch(() => "Ошибка загрузки списка проектов"));
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
      setCurrentProject: (project) => {
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
        }));
        // История undo принадлежала прошлому проекту — иначе Ctrl+Z «воскресит» его элементы.
        useEditorStore.temporal.getState().clear();
      },
      loadScene: async (id) => {
        try {
          const {currentProject} = get();
          if (!currentProject) {
            toast.error("Сначала выберите проект");
            set({scene: null, elements: [], selectedIds: [], activeGroupKey: null, selectedTableCell: null, currentComponentStateByElementKey: {}});
            return;
          }

          const res = await fetch(`/api/editor/scene/${id}?project_id=${currentProject.id}`);

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Ошибка ${res.status}: ${text}`);
          }

          const scene = await res.json();
          const newElements = transformElements(scene?.children ?? [], scene);

          // Иерархия: сцена обязана принадлежать выбранному проекту.
          if (!sceneBelongsToCurrentProject(scene, currentProject)) {
            toast.error("Сцена не принадлежит выбранному проекту");
            set({scene: null, elements: [], selectedIds: [], activeGroupKey: null, selectedTableCell: null, currentComponentStateByElementKey: {}});
            return;
          }

          set({scene, elements: newElements, selectedIds: [], activeGroupKey: null, selectedTableCell: null, currentComponentStateByElementKey: {}});

        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка загрузки сцены"));
          // Сбрасываем состояние при ошибке, чтобы не показывать данные от предыдущей сцены
          set({scene: null, elements: [], selectedIds: [], activeGroupKey: null, selectedTableCell: null, currentComponentStateByElementKey: {}});
        } finally {
          // Загрузка сцены — новая точка отсчёта: чистим историю undo, иначе Ctrl+Z
          // «воскресит» элементы прошлой сцены (с чужим parentKey и id:null → дубли на сервере).
          useEditorStore.temporal.getState().clear();
        }
      },
      createScene: async (name?: string) => {
        try {
          const {currentProject} = get();
          if (!currentProject) {
            toast.error("Сначала выберите проект");
            return;
          }

          // Если имя не передано из UI (например, нажата кнопка «Создать сцену»
          // в ToolsPanel), спрашиваем через window.prompt.
          const sceneName = (name ?? prompt("Название сцены"))?.trim();
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
          });

          // Новая сцена — новая точка отсчёта для undo.
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

          const res = await fetch(
            `/api/editor/scene/${id}?project_id=${currentProject.id}`,
            {method: 'DELETE'},
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Ошибка ${res.status}: ${text}`);
          }
          set(state => ({
            sceneList: state.sceneList.filter(s => s.id !== id),
            ...(state.scene?.id === id
              ? {scene: null, elements: [], selectedIds: [], activeGroupKey: null, selectedTableCell: null, currentComponentStateByElementKey: {}}
              : {}),
          }));
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
      ungroupSelected: () => {
        const { elements, selectedIds } = get();

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

          // Шаг А: Обновляем ВСЕХ членов разбиваемой группы (по parentKey — покрывает
          // и children, и composition). Прибавляем координаты исчезающей группы, причём
          // сдвигаем и базовые поля, и позиционные ключи в overrides состояний:
          // у перемещённого внутри группы листа актуальная позиция живёт в overrides,
          // и сдвиг только базового x/y «телепортирует» его на старое место.
          updatedElements = updatedElements.map((el) => {
            if (el.parentKey === groupId) {
              return {
                ...shiftElementPositions(el, groupX, groupY),
                // Член переходит под крыло "дедушки" (если группа сама была внутри группы)
                parentKey: grandParentKey,
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

        // Обновляем стейт
        set({
          elements: updatedElements,
          selectedIds: [...retainedSelectedIds, ...newlySelectedIds],
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

          return {elements: updated, selectedIds: [groupKey]};
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
