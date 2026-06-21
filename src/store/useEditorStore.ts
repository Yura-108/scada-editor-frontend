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
import {getComposition} from "@/lib/getComposition";
import {elementRegistry} from "@/constants/propertiesPanel";
import transformElements from "@/lib/transformElements";
import {toast} from "sonner";
import {PropertyCreateDto, PropertyCreateRequestDto} from "@/types/tags.types";
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
  loadScenesForProject: (projectId: number) => Promise<{id: number; name: string}[] | void>;
  loadProjectList: () => Promise<EditorProject[] | void>;
  createProject: (name: string) => Promise<EditorProject | void>;
  setCurrentProject: (project: EditorProject | null) => void;
  elements: DiagramElement[];
  selectedId: string | null;
  selectedIds: string[];
  activeGroupKey: string | null;
  enterGroup: (key: string) => void;
  exitGroup: () => void;
  currentComponentStateByElementKey: Record<string, string>;
  setCurrentComponentStateId: (elementKey: string, componentState: string) => void;
  clearCurrentComponentStateId: (elementKey: string) => void;
  clipboard: DiagramElement | null;
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

  setCanvasRect: (rect: DOMRect) => void;
  updateElement: (id: string, data: Partial<DiagramElement>) => void;
  updateElementVisual: (id: string, data: Partial<DiagramElement>) => void;
  select: (id: string | null) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  addComponentStateToSubtree: (elementKey: string, stateName: string) => string | null;
  addElementAt: (x: number, y: number, type: ElementType) => void;
  addTags: (payload: PropertyCreateRequestDto) => Promise<void>;
  editProperty: (propertyId: number, payload: PropertyCreateRequestDto) => Promise<void>;
  addTemplate: (screenX: number, screenY: number, template: DiagramElement[]) => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
  exportScene: () => void;
  importElementsFromJson: (rawElements: Record<string, unknown>[]) => void;
  loadScene: (id: number) => Promise<void>;
  createScene: () => Promise<void>;

  groupSelected: () => void;
  ungroupSelected: () => void;
  moveElementToGroup: (elementKey: string, targetGroupKey: string) => void;

  // removeElements: (ids: string[]) => void;
}

const isGroup = (el: DiagramElement) => el.type === "group";

const isComplex = (el: DiagramElement) =>
  elementRegistry[el.type as ElementType]?.complex ?? false;

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

  // Собираем цепочку групп-предков снизу вверх
  const ancestorGroupKeys: string[] = [];
  const movedEl = result.find(el => el.key === movedKey);
  let parentKey = movedEl?.parentKey ?? null;
  while (parentKey && parentKey !== sceneIdStr) {
    const parent = result.find(el => el.key === parentKey);
    if (!parent || parent.type !== "group") break;
    ancestorGroupKeys.push(parent.key);
    parentKey = parent.parentKey ?? null;
  }

  // Пересчитываем от самого глубокого предка к корневому
  for (const groupKey of ancestorGroupKeys) {
    const group = result.find(el => el.key === groupKey);
    if (!group || group.type !== "group") continue;

    const childKeySet = new Set(group.children);
    if (!childKeySet.size) continue;

    // Считаем абсолютные границы всех детей в актуальном state (result уже обновлён)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const childKey of childKeySet) {
      const child = result.find(el => el.key === childKey);
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
  }

  return result;
};

const getDescendantKeys = (rootKey: string, elements: DiagramElement[]) => {
  const result = new Set<string>();
  const queue = [rootKey];

  while (queue.length) {
    const currentKey = queue.shift()!;
    const current = elements.find(el => el.key === currentKey);

    if (!current) continue;

    for (const childKey of current.children ?? []) {
      if (result.has(childKey)) continue;

      result.add(childKey);
      queue.push(childKey);
    }
  }

  result.delete(rootKey);
  return [...result];
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
      currentComponentStateByElementKey: {},
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

      setCanvasRect: (rect) => set({canvasRect: rect}),
      addComponentStateToSubtree: (elementKey, stateName) => {
        let rootStateId: string | null = null;

        set(state => {
          const root = state.elements.find(el => el.key === elementKey);
          if (!root) return {};

          const existingRootState = root.states.find(s => s.name === stateName);
          rootStateId = existingRootState?.id ?? createUuid();

          const keysToUpdate = root.type === "group"
            ? [elementKey, ...getDescendantKeys(elementKey, state.elements)]
            : [elementKey];

          return {
            elements: state.elements.map(el => keysToUpdate.includes(el.key)
              ? ensureStateByName(el, stateName, el.key === elementKey ? rootStateId ?? undefined : undefined)
              : el
            ),
          };
        });

        return rootStateId;
      },
      setCurrentComponentStateId: (elementKey, componentState) => set(state => ({
        currentComponentStateByElementKey: (() => {
          const root = state.elements.find(el => el.key === elementKey);
          if (!root) {
            return {
              ...state.currentComponentStateByElementKey,
              [elementKey]: componentState,
            };
          }

          const nextMap = {
            ...state.currentComponentStateByElementKey,
            [elementKey]: componentState,
          };

          const rootStateName = root.states.find(s => s.id === componentState)?.name;
          if (!rootStateName) {
            return nextMap;
          }

          if (root.type !== "group") {
            return nextMap;
          }

          const descendantKeys = getDescendantKeys(elementKey, state.elements);

          for (const childKey of descendantKeys) {
            const child = state.elements.find(el => el.key === childKey);
            if (!child) continue;

            const matchedState = child.states.find(s => s.name === rootStateName);
            if (matchedState) {
              nextMap[childKey] = matchedState.id;
              continue;
            }

            const defaultState = child.states.find(s => s.isDefault) ?? child.states[0];
            nextMap[childKey] = defaultState?.id ?? componentState;
          }

          return nextMap;
        })(),
      })),
      clearCurrentComponentStateId: (elementKey) => set(state => {
        const next = {...state.currentComponentStateByElementKey};
        delete next[elementKey];

        return {currentComponentStateByElementKey: next};
      }),
       updateElementVisual: (key, updates) => {
         const { currentComponentStateByElementKey } = get();

         set(state => {
           const updatedElements = state.elements.map(el => {
             if (el.key !== key) return el;

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

             const currentComponentStateId = currentComponentStateByElementKey[key]
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
             return { elements: recomputeAncestorBounds(updatedElements, key, state.scene?.id) };
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
      select: (id) => set({selectedIds: id ? [id] : []}),
      selectMultiple: (ids) => set({selectedIds: [...ids]}),
      clearSelection: () => set({selectedIds: []}),
      enterGroup: (key) => set({activeGroupKey: key, selectedIds: []}),
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
        };
      }),
      addTemplate: (screenX, screenY, template) => {
        const {scene} = get();
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
        const { scene } = get();

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
            composition: parseBool(raw.composition, false),
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
      addElementAt: (screenX, screenY, type) => {
        const {scene} = get();
        const rect = get().canvasRect;
        if (!rect) return;

        const composition = getComposition(type);

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
            x1: x - 50,
            x2: x + 50,
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
            x, y, w: 160, h: 24,
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
            color: "#3b82f6", bg: "#e5e7eb",
            textColor: "#ffffff", showPercentage: true,
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

          const newProperty: PropertyCreateDto = await res.json();

          set(state => ({
            elements: state.elements.map(el =>
              el.id === payload.component_id
                ? { ...el, properties: [...(el.properties || []), newProperty]} as DiagramElement
                : el
            )
          }));
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

        const updatedProperty: PropertyCreateDto = await res.json();

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
      },
      deleteSelectedElement: async () => {
        const { selectedIds, elements } = get();
        if (!selectedIds.length) return;

        const selectedGroups = elements.filter(el => selectedIds.includes(el.key) && el.type === "group");

        const childrenIds = selectedGroups.flatMap(group => "children" in group ? group.children : []);

        const idsToDelete = new Set([...selectedIds, ...childrenIds]);

        // Собираем только id, которые существуют (не null/undefined)
        const ids = elements
          .filter(el => idsToDelete.has(el.key))
          .map(el => el.id)
          .filter((id): id is number => id !== null && id !== undefined);

        // Локально удаляем выделенные элементы (даже если у них не было id)
        set({
          elements: elements.filter(el => !idsToDelete.has(el.key)),
          selectedIds: [],
          currentComponentStateByElementKey: Object.fromEntries(
            Object.entries(get().currentComponentStateByElementKey).filter(([elementKey]) => !idsToDelete.has(elementKey))
          ),
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
          toast.error('Не удалось удалить элементы на сервере. Попробуйте снова.');
        }
      },
      copySelectedElement: () => {
        const { selectedIds, elements } = get();
        if (!selectedIds.length) return;

        // Копируем первый выделенный (самый простой вариант)
        const element = elements.find(el => el.key === selectedIds[0]);
        if (!element) return;

        set({ clipboard: { ...element } });

      },
      pasteSelectedElement: () => {
        const {clipboard} = get();

        if (!clipboard) return;

        const newElement = {
          ...clipboard,
          id: null,
          key: createUuid(),
          x: clipboard.x + 20,
          y: clipboard.y + 20,
          scripts: Array.isArray(clipboard.scripts) ? clipboard.scripts : [],
          bindings: Array.isArray(clipboard.bindings) ? clipboard.bindings : [],
        };

        set(state => ({
          elements: [...state.elements, newElement],
          selectedIds: [newElement.key],
        }));
      },
      exportScene: async () => {
        try {
          const {elements, scene} = get();

          const payload = buildComponentTree(elements, String(scene?.id));

          const res = await fetch("/api/editor/components", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Ошибка ${res.status}: ${text}`);
          }

          const oldData = await res.json();

          const newData = transformElements(oldData, scene);

          set({elements: newData});
          toast.success("Сохранено успешно!");
        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка экспорта сцены"));
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
      loadScenesForProject: async (projectId: number) => {
        return get().loadSceneList(projectId);
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
      setCurrentProject: (project) => set({currentProject: project}),
      loadScene: async (id) => {
        try {
          const res = await fetch(`/api/editor/scene/${id}`);

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Ошибка ${res.status}: ${text}`);
          }

          const scene = await res.json();
          const newElements = transformElements(scene?.children ?? [], scene);

          set({scene, elements: newElements, selectedIds: [], activeGroupKey: null, currentComponentStateByElementKey: {}});

        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка загрузки сцены"));
          // Сбрасываем состояние при ошибке, чтобы не показывать данные от предыдущей сцены
          set({scene: null, elements: [], selectedIds: [], activeGroupKey: null, currentComponentStateByElementKey: {}});
        }
      },
      createScene: async () => {
        try {
          const {currentProject} = get();
          if (!currentProject) {
            toast.error("Сначала выберите проект");
            return;
          }

          const name = prompt("Название сцены");
          if (!name) return;

          const payload = {name, project_id: currentProject.id};

          const res = await fetch("/api/editor/scene", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
          });

          const newScene = await res.json();

          set({scene: newScene, selectedIds: [], activeGroupKey: null, currentComponentStateByElementKey: {}});

          toast.success("Сцена создана");
        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка создания сцены"));
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
          const allChildKeys = [
            ...new Set([...(targetGroup.children ?? []), ...simpleKeys]),
          ];

          const boundsByKey = snapshotBounds(elements, allChildKeys);

          const updatedElements = layoutGroupFromBounds(
            elements,
            targetGroup.key,
            allChildKeys,
            boundsByKey,
            GROUP_PADDING,
            scene?.id,
          );

          set({
            elements: updatedElements,
            selectedIds: [targetGroup.key],
          });

          return;
        }

        const newGroupId = createUuid();
        const selectedKeys = topLevelSelected.map(el => el.key);
        const parentKeys = [...new Set(topLevelSelected.map(el => el.parentKey).filter(Boolean))];
        const commonParentKey = parentKeys.length === 1 ? parentKeys[0] : String(scene?.id) || null;
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
          composition: true,
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

        console.log(
          updatedElements
            .filter(el => selectedKeys.includes(el.key))
            .map(el => ({
              key: el.key,
              parentKey: el.parentKey,
              x: el.x,
              y: el.y,
            }))
        );

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
            children: groupChildrenIds
          } = group;

          newlySelectedIds.push(...groupChildrenIds);

          // Шаг А: Обновляем детей разбиваемой группы
          updatedElements = updatedElements.map((el) => {
            if (el.parentKey === groupId) {
              return {
                ...el,
                // Секрет плавности: прибавляем относительные координаты исчезающей группы
                // к координатам её ребенка. Визуально он останется на том же пикселе.
                x: el.x + groupX,
                y: el.y + groupY,
                // Ребенок переходит под крыло "дедушки" (если группа сама была внутри группы)
                parentKey: grandParentKey,
              };
            }
            return el;
          });

          // Шаг Б: Если удаляемая группа лежала ВНУТРИ другой группы ("дедушки")
          if (grandParentKey) {
            updatedElements = updatedElements.map((el) => {
              if (el.key === grandParentKey && el.type === "group") {
                return {
                  ...el,
                  children: [
                    ...el.children.filter((key) => key !== groupId), // убираем ID удаленной группы
                    ...groupChildrenIds,                           // добавляем ID её "выпавших" детей
                  ],
                };
              }
              return el;
            });
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
      moveElementToGroup: (elementKey, targetGroupKey) => {
        const { elements } = get();
        const element = elements.find(el => el.key === elementKey);
        const targetGroup = elements.find(el => el.key === targetGroupKey);

        if (!element || !targetGroup || targetGroup.type !== "group") return;

        const oldParentKey = element.parentKey;
        const {scene} = get();

        const targetChildKeys = [
          ...new Set([...(targetGroup.children ?? []), elementKey]),
        ];
        const targetBoundsByKey = snapshotBounds(elements, targetChildKeys);

        let updatedElements = elements.map(el => {
          if (el.key === oldParentKey && el.type === "group" && oldParentKey !== targetGroupKey) {
            return {
              ...el,
              children: el.children.filter(childKey => childKey !== elementKey),
            };
          }
          if (el.key === targetGroupKey) {
            const nextChildren = [...(el.children ?? [])];
            if (!nextChildren.includes(elementKey)) nextChildren.push(elementKey);
            return {...el, children: nextChildren};
          }
          return el;
        });

        updatedElements = layoutGroupFromBounds(
          updatedElements,
          targetGroupKey,
          targetChildKeys,
          targetBoundsByKey,
          GROUP_PADDING,
          scene?.id,
        );

        if (oldParentKey && oldParentKey !== targetGroupKey) {
          const oldGroup = updatedElements.find(
            el => el.key === oldParentKey && el.type === "group",
          ) as GroupElement | undefined;

          if (oldGroup?.children.length) {
            const oldBoundsByKey = snapshotBounds(updatedElements, oldGroup.children);
            updatedElements = layoutGroupFromBounds(
              updatedElements,
              oldParentKey,
              oldGroup.children,
              oldBoundsByKey,
              GROUP_PADDING,
              scene?.id,
            );
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
    }
  )
);
