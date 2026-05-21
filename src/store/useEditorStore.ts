import {snap} from "@/lib/utils";
import {create} from "zustand/react";
import {GroupElement, DiagramElement, ElementType, SceneType} from "@/types/editorElement.type";
import {temporal} from "zundo";
import getAbsolutePosition from "@/lib/getAbsolutePosition";
import {buildComponentTree} from "@/lib/buildComponentTree";
import {getComposition} from "@/lib/getComposition";
import {elementRegistry} from "@/constants/propertiesPanel";
import transformElements from "@/lib/transformElements";
import {toast} from "sonner";
import {PropertyCreateDto, PropertyCreateRequestDto} from "@/types/tags.types";
import {getElementBounds} from "@/lib/getElementBounds";

type EditorState = {
  scene: SceneType | null;
  sceneList: {id: number; name: string}[];
  loadSceneList: () => Promise<{id: number; name: string}[] | void>;
  elements: DiagramElement[];
  selectedId: string | null;
  selectedIds: string[];
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
  addTemplate: (screenX: number, screenY: number, template: DiagramElement[]) => void;
  addTags: (payload: PropertyCreateRequestDto) => Promise<void>;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
  exportScene: () => void;
  loadScene: (id: number) => Promise<void>;
  createScene: () => Promise<void>;

  groupSelected: () => void;
  ungroupSelected: () => void;

  // removeElements: (ids: string[]) => void;
}

const isGroup = (el: DiagramElement) => el.type === "group";

const isComplex = (el: DiagramElement) =>
  elementRegistry[el.type as ElementType]?.complex ?? false;

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

  return {
    ...element,
    states: [
      ...element.states,
      {
        id: forcedId ?? crypto.randomUUID(),
        name: stateName,
        overrides: {},
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
      elements: [],
      selectedId: null,
      selectedIds: [],
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
          rootStateId = existingRootState?.id ?? crypto.randomUUID();

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

        set(state => ({
          elements: state.elements.map(el => {
            if (el.key !== key) return el;

            const currentComponentStateId = currentComponentStateByElementKey[key]
              ?? el.states.find(s => s.isDefault)?.id
              ?? el.states[0]?.id;

            if (!currentComponentStateId) {
              return {
                ...el,
                ...updates,
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
                      ...updates,
                    },
                  }
                  : s
              ),
            } as DiagramElement;
          }),
        }));
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
      addTemplate: (screenX, screenY, template) => {
        const {scene} = get();
        const x = snap(screenX);
        const y = snap(screenY);

        const keyMap: Record<string, string> = {};
        template.forEach(el => {
          keyMap[el.key] = crypto.randomUUID();
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
          };

          // 2. Если это НАШ корневой элемент — задаем ему новые координаты на холсте
          if (el.key === root.key) {
            updatedElement.x = x;
            updatedElement.y = y;
            updatedElement.parentKey = String(scene?.id);
          }

          return updatedElement as DiagramElement;
        });

        set(state => ({
          elements: [...state.elements, ...newElements],
        }));

      },
      addElementAt: (screenX, screenY, type) => {
        const {scene} = get();
        const rect = get().canvasRect;
        if (!rect) return;

        const composition = getComposition(type);

        const x = snap(screenX + 150);
        const y = snap(screenY);

        if (type === 'line') {
          const newElement: DiagramElement = {
            id: null,
            key: crypto.randomUUID(),
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
              id: crypto.randomUUID(),
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

        const newElement: DiagramElement = {
          id: null,
          key: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
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
        const res = await fetch("/api/editor/tags/", {
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
      },
      deleteSelectedElement: async () => {
        const { selectedIds, elements } = get();
        if (!selectedIds.length) return;

        const selectedGroups = elements.filter(el => selectedIds.includes(el.key) && el.type === "group");

        const childrenIds = selectedGroups.flatMap(group => "children" in group ? group.children : []);

        const idsToDelete = new Set([...selectedIds, ...childrenIds]);

        const ids = elements
          .filter(el => [...idsToDelete].includes(el.key))
          .map(el => el.id)
          .filter(Boolean);

        try {
          await fetch(`/api/editor/components`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ids),
          });

          set({
            elements: elements.filter(el => !idsToDelete.has(el.key)),
            selectedIds: [],
            currentComponentStateByElementKey: Object.fromEntries(
              Object.entries(get().currentComponentStateByElementKey).filter(([elementKey]) => !idsToDelete.has(elementKey))
            ),
          });

        } catch (err) {
          console.error('Ошибка при удалении:', err);
          toast.error('Не удалось удалить элементы. Попробуйте снова.');
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
          key: crypto.randomUUID(),
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

          const oldData = await res.json();

          const newData = transformElements(oldData);

          console.log(newData)

          set({elements: newData});
          toast.success("Сохранено успешно!");
        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка экспорта сцены"));
        }
      },
      loadSceneList: async () => {
        try {
          const res = await fetch("/api/editor/scene");

          const json = await res.json();
          set({sceneList: json});
          return json;
        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка загрузки списка сцен"));
        }
      },
      loadScene: async (id) => {
        try {
          const res = await fetch(`/api/editor/scene/${id}`);

          const scene = await res.json();
          const newElements = transformElements(scene.children);

          set({scene, elements: newElements, selectedIds: [], currentComponentStateByElementKey: {}});

        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка загрузки сцены"));
        }
      },
      createScene: async () => {
        try {
          const name = prompt("Название сцены");
          if (!name) return;

          const res = await fetch("/api/editor/scene", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({name}),
          });

          const newScene = await res.json();

          set({scene: newScene, selectedIds: [], currentComponentStateByElementKey: {}});

          toast.success("Сцена создана");
        } catch (err: unknown) {
          console.error(err);
          toast.error(getErrorMessage(err, "Ошибка создания сцены"));
        }
      },
      groupSelected: () => {
        const { elements, selectedIds, scene } = get();
        if (selectedIds.length < 2) return;

        const padding = 60;

        // -----------------------------
        // 1. TOP LEVEL SELECTION
        // -----------------------------
        const topLevelSelected = elements
          .filter(el => selectedIds.includes(el.key))
          .filter(el => {
            let parentKey: string | null | undefined = el!.parentKey;

            while (parentKey) {
              if (selectedIds.includes(parentKey)) return false;
              parentKey = elements.find(e => e.key === parentKey)?.parentKey;
            }

            return true;
          }) as DiagramElement[];

        if (topLevelSelected.length < 2) return;

        // -----------------------------
        // 2. CLASSIFY ELEMENTS
        // -----------------------------
        const simple = topLevelSelected.filter(
          el => !isGroup(el) && !isComplex(el)
        );

        const complex = topLevelSelected.filter(
          el => isComplex(el)
        );

        const groups = topLevelSelected.filter(isGroup);

        // -----------------------------
        // 3. TRY TO ADD SIMPLE → EXISTING GROUP
        // -----------------------------
        if (
          simple.length > 0 &&
          complex.length === 0 &&
          groups.length === 1
        ) {
          const targetGroup = groups[0] as GroupElement;

          // 1. Считаем границы новых элементов (в абсолютных координатах)
          let minX = targetGroup.x;
          let minY = targetGroup.y;
          let maxX = targetGroup.x + (targetGroup.w || 0);
          let maxY = targetGroup.y + (targetGroup.h || 0);

          const simpleWithAbs = simple.map(s => ({
            el: s,
            abs: getAbsolutePosition(s, elements)
          }));

          simpleWithAbs.forEach(({ el, abs }) => {
            minX = Math.min(minX, abs.x);
            minY = Math.min(minY, abs.y);
            maxX = Math.max(maxX, abs.x + (el.w || 0));
            maxY = Math.max(maxY, abs.y + (el.h || 0));
          });

          // 2. Рассчитываем смещение (если группа расширилась влево или вверх)
          const dx = targetGroup.x - minX;
          const dy = targetGroup.y - minY;

          // 3. Обновляем все элементы
          const updatedElements = elements.map(el => {
            // Если это новый добавляемый элемент
            const newSimple = simpleWithAbs.find(s => s.el.key === el.key);
            if (newSimple) {
              return {
                ...el,
                parentKey: targetGroup.key,
                x: newSimple.abs.x - minX,
                y: newSimple.abs.y - minY,
              };
            }

            // Если это старый ребенок этой же группы — корректируем его позицию из-за сдвига группы
            if (el.parentKey === targetGroup.key) {
              return {
                ...el,
                x: (el.x || 0) + dx,
                y: (el.y || 0) + dy,
              };
            }

            // Если это сама группа — обновляем её размеры и позицию
            if (el.key === targetGroup.key) {
              return {
                ...targetGroup,
                x: minX,
                y: minY,
                w: maxX - minX,
                h: maxY - minY,
                children: [
                  ...(targetGroup.children ?? []),
                  ...simple.map(s => s.key),
                ],
              };
            }

            return el;
          });

          set({
            elements: updatedElements,
            selectedIds: [targetGroup.key],
          });

          return;
        }

        // -----------------------------
        // 4. CREATE NEW GROUP
        // -----------------------------
        const newGroupId = crypto.randomUUID();

        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        topLevelSelected.forEach(el => {
          const bounds = getElementBounds(el, elements);

          minX = Math.min(minX, bounds.minX);
          minY = Math.min(minY, bounds.minY);
          maxX = Math.max(maxX, bounds.maxX);
          maxY = Math.max(maxY, bounds.maxY);
        });

        const updatedElements = elements.map(el => {
          const isTopLevelSelected = topLevelSelected.some(t => t.key === el.key);
          if (!isTopLevelSelected) return el;

          const bounds = getElementBounds(el, elements);

          // Базовые новые координаты (для левого верхнего угла ИЛИ центра линии)
          const newX = bounds.absX - minX + padding / 2;
          const newY = bounds.absY - minY + padding / 2;

          if (el.type === "line") {
            return {
              ...el,
              x: newX,
              y: newY,
              // Обязательно переводим концы линии в локальную систему координат группы!
              x1: bounds.absX1! - minX + padding / 2,
              y1: bounds.absY1! - minY + padding / 2,
              x2: bounds.absX2! - minX + padding / 2,
              y2: bounds.absY2! - minY + padding / 2,
              parentKey: newGroupId,
              parentId: null,
            };
          }

          return {
            ...el,
            x: newX,
            y: newY,
            parentKey: newGroupId,
            parentId: null,
          };
        });

        const group: GroupElement = {
          id: null,
          key: newGroupId,
          type: "group",
          x: minX,
          y: minY,
          w: maxX - minX + padding, // Ширина теперь рассчитана идеально
          h: maxY - minY + padding, // Высота тоже
          composition: true,
          children: topLevelSelected.map(el => el.key),
          parentId: scene?.id || null,
          parentKey: String(scene?.id) || null,
          label: `Group (${topLevelSelected.length})`,
          bg: "rgba(59,130,246,0.08)",
          borderStyle: "dashed",
          borderColor: "#3b82f6",
          scripts: [],
          bindings: [],
          properties: [],
          states: [{
            id: crypto.randomUUID(),
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
          // Нам нужно обновить массив children у этого "дедушки"
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

        // 3. Сохраняем в выделении обычные фигуры, если они были выделены вместе с группами
        const retainedSelectedIds = selectedIds.filter((id) => !groupIdsToRemove.includes(id));

        // Обновляем стейт
        set({
          elements: updatedElements,
          selectedIds: [...retainedSelectedIds, ...newlySelectedIds],
        });
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