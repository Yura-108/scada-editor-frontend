import {PaletteItemResponseDTO, PaletteItemType} from "@/types/palette.types";
import {create} from "zustand";
import {paletteItems} from "@/constants/palette";
import {toast} from "sonner";
import {buildSingleComponentTree} from "@/lib/buildComponentTree";
import transformElements from "@/lib/transformElements";

type PaletteState = {
  paletteItems: PaletteItemType[];
  addPaletteItem: (paletteItem: PaletteItemType) => void;
  loadPaletteItems: () => Promise<void>;
  createPaletteItem: (paletteItem: Omit<PaletteItemType, 'id'>) => Promise<void>;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  paletteItems: paletteItems,
  addPaletteItem: (paletteItem) => {
    set({
      paletteItems: [...get().paletteItems, paletteItem]
    })
  },
  loadPaletteItems: async () => {
    try {
      const res = await fetch("/api/editor/palette/");

      const json: PaletteItemResponseDTO[] = await res.json();

      const paletteItems: PaletteItemType[] = json.map(item => {
        const components = transformElements([item.rootComponent]);
        return {
          id: item.id,
          type: 'custom',
          name: item.name,
          category: item.type,
          defaultProps: {},
          template: components,
        }
      });

      set({
        paletteItems: [...get().paletteItems, ...paletteItems]
      });
      toast.success("Список элементов загружен");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ошибка загрузки списка элементов");
    }
  },
  createPaletteItem: async (paletteItem) => {
    try {
      if (!paletteItem.template) return;
      const rootElementKey = paletteItem.template.find(el => el.type === 'group')?.key;

      const paletteItemCreateDTO = {
        name: paletteItem.name,
        type: paletteItem.category,
        rootComponent: buildSingleComponentTree(paletteItem.template, rootElementKey)
      };

      const res = await fetch("/api/editor/palette/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(paletteItemCreateDTO),
      });


      const paletteItemResponse: PaletteItemResponseDTO = await res.json();

      const newPaletteItem: PaletteItemType = {
        id: paletteItemResponse.id,
        name: paletteItemResponse.name,
        type: 'custom',
        category: paletteItemResponse.type,
        defaultProps: paletteItem.defaultProps,
        template: transformElements([paletteItemResponse.rootComponent])
      }
      set({
        paletteItems: [...get().paletteItems, newPaletteItem]
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ошибка загрузки списка элементов");
    }
  }
}))

