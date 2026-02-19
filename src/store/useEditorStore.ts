import {create} from "zustand/react";

export type ElementType = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  bg?: string;
};


type EditorState = {
  elements: ElementType[];
  selectedId: string | null;
  canvasRect: DOMRect | null;

  setCanvasRect: (rect: DOMRect) => void;
  addElement: () => void;
  updateElement: (id: string, data: Partial<ElementType>) => void;
  select: (id: string | null) => void;
  addElementAt: (x: number, y: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  elements: [],
  selectedId: null,
  canvasRect: null,
  setCanvasRect: (rect) => set({canvasRect: rect}),
  addElement: () =>
    set(s => ({
      elements: [
        ...s.elements,
        {
          id: crypto.randomUUID(),
          x: 50,
          y: 50,
          w: 120,
          h: 60
        },
      ],
    })),

  updateElement: (id, data) =>
    set(s => ({
      elements: s.elements.map(el =>
      el.id === id ? {...el, ...data} : el
      ),
    })),
  select: (id) => set({selectedId: id}),
  addElementAt: (x, y) =>
    set(s => ({
      elements: [
        ...s.elements,
        {
          id: crypto.randomUUID(),
          x,
          y,
          w: 120,
          h: 60,
          label: "Element",
          bg: "#000000"
        },
      ],
    })),
}));