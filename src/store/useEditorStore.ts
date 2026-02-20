import { snap } from "@/lib/utils";
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
  clipboard: ElementType | null;
  canvasRect: DOMRect | null;

  setCanvasRect: (rect: DOMRect) => void;
  addElement: () => void;
  updateElement: (id: string, data: Partial<ElementType>) => void;
  select: (id: string | null) => void;
  addElementAt: (x: number, y: number) => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  elements: [],
  selectedId: null,
  clipboard: null,
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
  addElementAt: (screenX, screenY) => {
    const rect = get().canvasRect;
    if (!rect) return;

    const x = snap(screenX);
    const y = snap(screenY);

    set(state => ({
      elements: [...state.elements, {
        id: crypto.randomUUID(),
        x,
        y,
        w: 120,
        h: 60,
        label: "Element",
        bg: "#000000"
      }]
    }));
  },
  deleteSelectedElement: () => {
    const {selectedId} = get();

    if (!selectedId) return;

    set(state => ({
      elements: state.elements.filter((el) => el.id !== selectedId),
    }));

    set({selectedId: null});
  },
  copySelectedElement: () => {
    const {selectedId, elements} = get();

    if (!selectedId) return;

    const element = elements.find((el) => el.id === selectedId);

    if (!element) return;

    set({clipboard: {...element}});
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
    }))
    set({selectedId: newElement.id});
  },
}));