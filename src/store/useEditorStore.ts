import {snap} from "@/lib/utils";
import {create} from "zustand/react";
import {GroupElement, CanvasSchema, DiagramElement, ElementType} from "@/types/editorElement.type";
import {temporal} from "zundo";
import getAbsolutePosition from "@/lib/getAbsolutePosition";
import buildComponentTree from "@/lib/buildComponentTree";

type EditorState = {
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
  exportSchema: () => void;
  loadSchema: (schema: CanvasSchema) => void;

  groupSelected: () => void;
  ungroupSelected: () => void;

  // removeElements: (ids: string[]) => void;
}

export const useEditorStore = create<EditorState>()(temporal(
    (set, get) => ({
      elements: [],
      selectedId: null,
      selectedIds: [],
      clipboard: null,
      canvasRect: null,
      connecting: null,

      setCanvasRect: (rect) => set({canvasRect: rect}),
      updateElement: (id: string, updates: Partial<DiagramElement>) => {
        set(state => ({
          elements: state.elements.map(el =>
            el.id === id
              ? { ...el, ...updates } as DiagramElement
              : el
          )
        }));
      },
      select: (id) => set({selectedIds: id ? [id] : []}),
      selectMultiple: (ids) => set({selectedIds: [...ids]}),
      clearSelection: () => set({selectedIds: []}),
      addElementAt: (screenX, screenY, type) => {
        const rect = get().canvasRect;
        if (!rect) return;

        const x = snap(screenX);
        const y = snap(screenY);

        const newElement: DiagramElement = {
          id: crypto.randomUUID(),
          type,
          x,
          y,
          w: 120,
          h: 80,
          parentId: null,
          children: [],
          label: "Element",
          bg: "transparent",
        };

        set(state => ({
          elements: [...state.elements, newElement]
        }))
      },
      deleteSelectedElement: () => {
        const { selectedIds, elements } = get();
        if (!selectedIds.length) return;

        const selectedGroups = elements.filter(el => selectedIds.includes(el.id) && el.type === "group");

        const childrenIds = selectedGroups.flatMap(group => "children" in group ? group.children : []);

        const idsToDelete = new Set([...selectedIds, ...childrenIds]);

        set({
          elements: elements.filter(el => !idsToDelete.has(el.id)),
          selectedIds: [],
        });
      },
      copySelectedElement: () => {
        const { selectedIds, elements } = get();
        if (!selectedIds.length) return;

        // Копируем первый выделенный (самый простой вариант)
        const element = elements.find(el => el.id === selectedIds[0]);
        if (!element) return;

        set({ clipboard: { ...element } });

      },
      pasteSelectedElement: () => {
        const {clipboard} = get();

        if (!clipboard) return;

        const newElement = {
          ...clipboard,
          id: crypto.randomUUID(),
          x: clipboard.x + 20,
          y: clipboard.y + 20,
        };

        set(state => ({
          elements: [...state.elements, newElement],
          selectedIds: [newElement.id],
        }));
      },
      exportSchema: () => {
        const {elements} = get();

        const payload = buildComponentTree(elements);

        console.log(payload)

        const schema = {
          key: crypto.randomUUID(),
          type: "",
          label: "Mew Screen",
          components: elements,
          version: 1,

        }

        // console.log(JSON.stringify(schema));
        // await fetch("/api/screens", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify(schema),
        // });
      },
      loadSchema: (schema) => {
        set({
          elements: schema.elements
        });
      },
      groupSelected: () => {
        const { elements, selectedIds } = get();

        if (selectedIds.length < 2) return;

        const topLevelSelectedIds = selectedIds.filter(id => {
          let el = elements.find(el => el.id === id);
          let parentId = el?.parentId;

          while (parentId) {
            if (selectedIds.includes(parentId)) return false;
            const parentEl = elements.find(el => el.id === parentId);
            parentId = parentEl?.parentId;
          }
          return true;
        });

        if (topLevelSelectedIds.length < 2) return;

        // const leafIds = selectedIds.filter(id => {
        //   const el = elements.find(e => e.id === id);
        //   return el && el.type !== "group";
        // });
        //
        // if (leafIds.length < 2) return;

        const newGroupId = crypto.randomUUID();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        topLevelSelectedIds.forEach(id => {
          const el = elements.find(e => e.id === id);
          if (!el) return;

          const abs = getAbsolutePosition(el, elements);

          minX = Math.min(minX, abs.x);
          minY = Math.min(minY, abs.y);
          maxX = Math.max(maxX, abs.x + (el.w || 0));
          maxY = Math.max(maxY, abs.y + (el.h || 0));
        });

        const updatedElements = elements.map(el => {
          if (!topLevelSelectedIds.includes(el.id)) return el;

          const abs = getAbsolutePosition(el, elements);
          return {
            ...el,
            x: abs.x - minX,
            y: abs.y - minY,
            parentId: newGroupId,
          };
        });

        const group: GroupElement = {
          id: newGroupId,
          type: "group",
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
          children: [...topLevelSelectedIds],
          parentId: null,
          label: `Group (${topLevelSelectedIds.length})`,
          bg: "rgba(59, 130, 246, 0.08)",
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
          (el) => selectedIds.includes(el.id) && el.type === "group"
        );

        // Если не выделено ни одной группы, ничего не делаем
        if (groupsToUngroup.length === 0) return;

        const groupIdsToRemove = groupsToUngroup.map((g) => g.id);

        // Здесь мы соберем ID элементов, которые освободятся из-под групп,
        // чтобы автоматически сделать их выделенными после разгруппировки
        let newlySelectedIds: string[] = [];

        // Работаем с копией массива элементов
        let updatedElements = [...elements];

        // Проходимся по каждой группе, которую нужно разбить
        groupsToUngroup.forEach((group) => {
          const {
            id: groupId,
            x: groupX,
            y: groupY,
            parentId: grandParentId,
            children: groupChildrenIds
          } = group;

          newlySelectedIds.push(...groupChildrenIds);

          // Шаг А: Обновляем детей разбиваемой группы
          updatedElements = updatedElements.map((el) => {
            if (el.parentId === groupId) {
              return {
                ...el,
                // Секрет плавности: прибавляем относительные координаты исчезающей группы
                // к координатам её ребенка. Визуально он останется на том же пикселе.
                x: el.x + groupX,
                y: el.y + groupY,
                // Ребенок переходит под крыло "дедушки" (если группа сама была внутри группы)
                parentId: grandParentId,
              };
            }
            return el;
          });

          // Шаг Б: Если удаляемая группа лежала ВНУТРИ другой группы ("дедушки")
          // Нам нужно обновить массив children у этого "дедушки"
          if (grandParentId) {
            updatedElements = updatedElements.map((el) => {
              if (el.id === grandParentId && el.type === "group") {
                return {
                  ...el,
                  children: [
                    ...el.children.filter((id) => id !== groupId), // убираем ID удаленной группы
                    ...groupChildrenIds,                           // добавляем ID её "выпавших" детей
                  ],
                };
              }
              return el;
            });
          }
        });

        // 2. Окончательно удаляем сами разбитые группы из массива
        updatedElements = updatedElements.filter((el) => !groupIdsToRemove.includes(el.id));

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