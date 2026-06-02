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
        id: forcedId ?? createUuid(),
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
      currentProject: null,
      projectList: [],
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

         set(state => ({
           elements: state.elements.map(el => {
             if (el.key !== key) return el;

             // Валидация: гарантируем минимальные размеры для групп и элементов
             const MIN_SIZE = 20;
             const validatedUpdates = {
               ...updates,
               ...(updates.w !== undefined && { w: Math.max(MIN_SIZE, updates.w) }),
               ...(updates.h !== undefined && { h: Math.max(MIN_SIZE, updates.h) }),
             };

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
      loadSceneList: async (projectId: number) => {
        try {
          const res = await fetch(`/api/editor/scene?project_id=${projectId}`);

          if (!res.ok) {
            throw new Error(await res.text().catch(() => "Ошибка загрузки списка сцен"));
          }

          const json = await res.json();
          set({sceneList: json});
          return json;
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

          set({scene: newScene, selectedIds: [], currentComponentStateByElementKey: {}});

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
