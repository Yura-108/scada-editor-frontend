import {snap} from "@/lib/utils";
import {create} from "zustand/react";
import {BaseElement, GroupElement, BaseElementType, CanvasSchema, ConnectionElement, ElementType} from "@/types/editorElement.type";
import {temporal} from "zundo";

type EditorState = {
  elements: ElementType[];
  selectedId: string | null;
  selectedIds: string[];
  clipboard: ElementType | null;
  canvasRect: DOMRect | null;
  connecting: {
    fromNode: string;
    fromPort: string;
    mouseX: number;
    mouseY: number;
  } | null;

  setCanvasRect: (rect: DOMRect) => void;
  updateElement: (id: string, data: Partial<ElementType>) => void;
  select: (id: string | null) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  addElementAt: (x: number, y: number, type: BaseElementType | "connection") => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
  startConnection: (nodeId: string, portId: string) => void;
  updateConnectionPosition: (x: number, y: number) => void;
  finishConnection: (toNode: string, toPort: string) => void;
  cancelConnection: () => void;
  exportSchema: () => void;
  loadSchema: (schema: CanvasSchema) => void;

  groupSelected: () => void;
  ungroupSelected: () => void;

  removeElements: (ids: string[]) => void;
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
          const oldX = element.x;
          const oldY = element.y;
          const newX = updates.x ?? oldX;
          const newY = updates.y ?? oldY;

          const deltaX = newX - oldX;
          const deltaY = newY - oldY;

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
      addElementAt: (screenX: number, screenY: number, type: string) => {
        if (type === "connection") return;
        const rect = get().canvasRect;
        if (!rect) return;

        const x = snap(screenX);
        const y = snap(screenY);

        const newElement: BaseElement = {
          id: crypto.randomUUID(),
          type,
          x,
          y,
          w: 80,
          h: 60,
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
        if (!element || element.type === "connection") return;

        set({ clipboard: { ...element } });
      },
      pasteSelectedElement: () => {
        const { clipboard, elements } = get();
        if (!clipboard || clipboard.type === "connection") return;

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
      startConnection: (nodeId, portId) => {
        set({
          connecting: {
            fromNode: nodeId,
            fromPort: portId,
            mouseX: 0,
            mouseY: 0
          }
        })
      },
      updateConnectionPosition: (x, y) => set(state =>
        state.connecting
          ? {connecting: {...state.connecting, mouseX: x, mouseY: y}}
          : {}
      ),
      finishConnection: (toNode, toPort) => {
        const {connecting, elements} = get();

        if (!connecting) return;

        if (
          connecting.fromNode === toNode &&
          connecting.fromPort === toPort
        ) {
          set({connecting: null});
          return;
        }

        const newConnection: ConnectionElement = {
          id: crypto.randomUUID(),
          type: "connection",
          fromNode: connecting.fromNode,
          fromPort: connecting.fromPort,
          toNode,
          toPort,
        };

        set({
          elements: [...elements, newConnection],
          connecting: null,
        });
      },
      cancelConnection: () => set({connecting: null}),
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
// В store:
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
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.w);
          maxY = Math.max(maxY, el.y + el.h);
        });

        // Обновляем детей: делаем их координаты относительными и добавляем parentId
        const updatedElements = elements.map(el => {
          if (leafIds.includes(el.id)) {
            return {
              ...el,
              x: el.x - minX, // теперь координаты относительно группы
              y: el.y - minY,
              parentId: newGroupId,
            };
          }
          return el;
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
          // Возвращаем детям абсолютные координаты и убираем parentId
          newElements = newElements.map(el => {
            if (group.children.includes(el.id)) {
              return {
                ...el,
                x: el.x + group.x, // превращаем относительные координаты в абсолютные
                y: el.y + group.y,
                parentId: undefined,
              };
            }
            return el;
          });

          // Удаляем саму группу
          newElements = newElements.filter(e => e.id !== group.id);
        });

        set({
          elements: newElements,
          selectedIds: groups.flatMap(g => g.children),
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
          // Убираем parentId у детей и делаем их координаты абсолютными
          newElements = newElements.map(el => {
            if (group.children.includes(el.id)) {
              return {
                ...el,
                x: el.x + group.x, // превращаем относительные координаты в абсолютные
                y: el.y + group.y,
                parentId: undefined,
              };
            }
            return el;
          });

          // Удаляем саму группу
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
      equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }
  )
);