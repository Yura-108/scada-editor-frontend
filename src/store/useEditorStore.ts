import {snap} from "@/lib/utils";
import {create} from "zustand/react";
import {GroupElement, CanvasSchema, DiagramElement, ElementType} from "@/types/editorElement.type";
import {temporal} from "zundo";
import getAbsolutePosition from "@/lib/getAbsolutePosition";

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
        const state = get();
        const element = state.elements.find(el => el.id === id);

        if (!element) return;

        if (element.type === "group" && (updates.x !== undefined || updates.y !== undefined)) {

          const updatedElements = state.elements.map(el => {
            if (el.id === id) {
              return { ...el, ...updates };
            }

            if (el.parentId === id) {
              return {
                ...el,
                x: el.x, // координаты детей остаются относительными! не меняем их
                y: el.y,
              };
            }

            return el;
          });

          set({ elements: updatedElements });
        } else {
          set(state => ({
            elements: state.elements.map(el =>
              el.id === id ? { ...el, ...updates } : el
            )
          }));
        }
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

        set({
          elements: elements.filter(el => !selectedIds.includes(el.id)),
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

        const schema = {
          id: crypto.randomUUID(),
          name: "Mew Screen",
          elements,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

        const leafIds = selectedIds.filter(id => {
          const el = elements.find(e => e.id === id);
          return el && el.type !== "group";
        });

        if (leafIds.length < 2) return;

        const newGroupId = crypto.randomUUID();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        leafIds.forEach(id => {
          const el = elements.find(e => e.id === id);
          if (!el) return;

          const abs = getAbsolutePosition(el, elements);

          minX = Math.min(minX, abs.x);
          minY = Math.min(minY, abs.y);
          maxX = Math.max(maxX, abs.x + el.w);
          maxY = Math.max(maxY, abs.y + el.h);
        });

        const updatedElements = elements.map(el => {
          if (!leafIds.includes(el.id)) return el;
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
          children: [...leafIds],
          label: `Group (${leafIds.length})`,
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

        const groups = selectedIds
          .map(id => elements.find(el => el.id === id && el.type === "group"))
          .filter(Boolean) as GroupElement[];

        if (!groups.length) return;

        let newElements = [...elements];

        groups.forEach(group => {
          const groupAbs = getAbsolutePosition(group, elements);

          newElements = newElements.map(el => {
            if (!group.children.includes(el.id)) return el;

            const childAbs = getAbsolutePosition(el, elements);

            return {
              ...el,
              x: childAbs.x,
              y: childAbs.y,
              parentId: undefined,
            };
          });

          newElements = newElements.filter(e => e.id !== group.id);
        });

        set({
          elements: newElements,
          selectedIds: groups.flatMap(g => g.children),
        });
      },
    }),
    {
      limit: 50,
      partialize: (state) => ({
        elements: state.elements,
      }),
    }
  )
);