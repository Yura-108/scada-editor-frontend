import {snap} from "@/lib/utils";
import {create} from "zustand/react";
import {BaseElement, BaseElementType, CanvasSchema, ConnectionElement, ElementType} from "@/types/editorElement.type";
import {temporal} from "zundo";

type EditorState = {
  elements: ElementType[];
  selectedId: string | null;
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
}

export const useEditorStore = create<EditorState>()(temporal(
    (set, get) => ({
      elements: [],
      selectedId: null,
      clipboard: null,
      canvasRect: null,
      connecting: null,

      setCanvasRect: (rect) => set({canvasRect: rect}),
      updateElement: (id, data) => set(state => ({
        elements: state.elements.map(el => {
          if (el.id !== id) return el;

          if (el.type !== "connection") {
            return {...el, ...(data as Partial<BaseElement>)};
          }

          if (el.type === "connection") {
            return {...el, ...(data as Partial<ConnectionElement>)};
          }

          return el;
        }),
      })),
      select: (id) => set({selectedId: id}),
      addElementAt: (screenX, screenY, type) => {
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
          // ports: [
          //   {id: crypto.randomUUID(), position: "top"},
          //   {id: crypto.randomUUID(), position: "right"},
          //   {id: crypto.randomUUID(), position: "bottom"},
          //   {id: crypto.randomUUID(), position: "left"},
          // ],
        };

        set(state => ({
          elements: [...state.elements, newElement]
        }))
      },
      deleteSelectedElement: () => {
        const {selectedId, elements} = get();
        if (!selectedId) return;

        set({
          elements: elements.filter(el => {
            if (el.id === selectedId) return false;

            if (el.type === "connection") {
              //return el.from !== selectedId && el.to !== selectedId;
            }

            return true;
          }),
          selectedId: null
        });
      },
      copySelectedElement: () => {
        const {selectedId, elements} = get();
        if (!selectedId) return;

        const element = elements.find((el) => el.id === selectedId);

        if (!element || element.type === "connection") return;

        set({clipboard: {...element}});
      },
      pasteSelectedElement: () => {
        const {clipboard} = get();
        if (!clipboard || clipboard.type === "connection") return;

        const newElement = {
          ...clipboard,
          id: crypto.randomUUID(),
          x: clipboard.x + 20,
          y: clipboard.y + 20,
        };

        set(state => ({
          elements: [...state.elements, newElement],
        }))
        set({selectedId: newElement.id});
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