import {snap} from "@/lib/utils";
import {create} from "zustand/react";
import {GroupElement, DiagramElement, ElementType, SceneType} from "@/types/editorElement.type";
import {temporal} from "zundo";
import getAbsolutePosition from "@/lib/getAbsolutePosition";
import buildComponentTree from "@/lib/buildComponentTree";
import {getComposition} from "@/lib/getComposition";
import {elementRegistry} from "@/constants/propertiesPanel";
import transformElements from "@/lib/transformElements";
import {toast} from "sonner";

type EditorState = {
  scene: SceneType | null;
  sceneList: {id: number; name: string}[];
  loadSceneList: () => any;
  elements: DiagramElement[];
  selectedId: string | null;
  selectedIds: string[];
  clipboard: DiagramElement | null;
  canvasRect: DOMRect | null;
  connecting: {
    fromNode: string;
    fromPort: string;
    mouseX: number;
    mouseY: number;
  } | null;

  setCanvasRect: (rect: DOMRect) => void;
  updateElement: (id: string, data: Partial<DiagramElement>) => void;
  select: (id: string | null) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  addElementAt: (x: number, y: number, type: ElementType) => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
  exportScene: () => void;
  loadScene: (id: number) => void;
  createScene: () => void;

  groupSelected: () => void;
  ungroupSelected: () => void;

  // removeElements: (ids: string[]) => void;
}

const isGroup = (el: DiagramElement) => el.type === "group";

const isComplex = (el: DiagramElement) =>
  elementRegistry[el.type as ElementType]?.complex ?? false;

export const useEditorStore = create<EditorState>()(temporal(
    (set, get) => ({
      scene: null,
      sceneList: [],
      elements: [],
      selectedId: null,
      selectedIds: [],
      clipboard: null,
      canvasRect: null,
      connecting: null,

      setCanvasRect: (rect) => set({canvasRect: rect}),
      updateElement: (key: string, updates: Partial<DiagramElement>) => {
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
      addElementAt: (screenX, screenY, type) => {
        const {scene} = get();
        const rect = get().canvasRect;
        if (!rect) return;

        const composition = getComposition(type);

        const x = snap(screenX);
        const y = snap(screenY);

        const newElement: DiagramElement = {
          id: null,
          key: crypto.randomUUID(),
          type,
          composition,
          x,
          y,
          w: type === 'line' ? 10 : 80,
          h: type === 'line' ? 10 : 80,
          parentId: scene?.id || null,
          parentKey: null,
          children: [],
          label: "Element",
          bg: "transparent",
        };

        set(state => ({
          elements: [...state.elements, newElement]
        }))
      },
      deleteSelectedElement: async () => {
        const { selectedIds, elements } = get();
        if (!selectedIds.length) return;

        const selectedGroups = elements.filter(el => selectedIds.includes(el.key) && el.type === "group");

        const childrenIds = selectedGroups.flatMap(group => "children" in group ? group.children : []);

        const idsToDelete = new Set([...selectedIds, ...childrenIds]);

        try {
          await fetch(`/api/editor`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([...selectedIds])
          });

          set({
            elements: elements.filter(el => !idsToDelete.has(el.key)),
            selectedIds: [],
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
        };

        set(state => ({
          elements: [...state.elements, newElement],
          selectedIds: [newElement.key],
        }));
      },
      exportScene: async () => {
        try {
          const {elements} = get();

          const payload = buildComponentTree(elements);

          const res = await fetch("/api/editor/components", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
          });

          const oldData = await res.json();
          const newData = transformElements(oldData);

          set({elements: newData});
          toast.success("Сохранено успешно!");
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || "Ошибка экспорта сцены");
        }
      },
      loadSceneList: async () => {
        try {
          const res = await fetch("/api/editor/scene");

          const json = await res.json();
          set({sceneList: json});
          toast.success("Список сцен загружен");
          return json;
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || "Ошибка загрузки списка сцен");
        }
      },
      loadScene: async (id) => {
        try {
          const res = await fetch(`/api/editor/scene/${id}`);

          const scene = await res.json();
          const newElements = transformElements(scene.children);

          set({scene, elements: newElements});


        } catch (err: any) {
          console.error(err);
          toast.error(err.message || "Ошибка загрузки сцены");
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

          set({scene: newScene});

          toast.success("Сцена создана");
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || "Ошибка создания сцены");
        }
      },
      groupSelected: () => {
        const { elements, selectedIds, scene } = get();
        if (selectedIds.length < 2) return;

        // -----------------------------
        // 1. TOP LEVEL SELECTION
        // -----------------------------
        const topLevelSelected = selectedIds
          .map(key => elements.find(e => e.key === key))
          .filter(Boolean)
          .filter(el => {
            let parentKey: string | null | undefined = el!.parentKey;

            while (parentKey) {
              if (selectedIds.includes(parentKey)) return false;
              parentKey = elements.find(e => e.id === parentKey)?.parentKey;
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
            const newSimple = simpleWithAbs.find(s => s.el.id === el.id);
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
          const abs = getAbsolutePosition(el, elements);

          minX = Math.min(minX, abs.x);
          minY = Math.min(minY, abs.y);
          maxX = Math.max(maxX, abs.x + (el.w || 0));
          maxY = Math.max(maxY, abs.y + (el.h || 0));
        });

        const updatedElements = elements.map(el => {
          if (!topLevelSelected.find(t => t.id === el.id)) return el;

          const abs = getAbsolutePosition(el, elements);

          return {
            ...el,
            x: abs.x - minX,
            y: abs.y - minY,
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
          w: maxX - minX,
          h: maxY - minY,
          composition: true,
          children: topLevelSelected.map(el => el.key),
          parentId: scene?.id || null,
          parentKey: null,
          label: `Group (${topLevelSelected.length})`,
          bg: "rgba(59,130,246,0.08)",
          borderStyle: "dashed",
          borderColor: "#3b82f6",
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
        let newlySelectedIds: string[] = [];

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