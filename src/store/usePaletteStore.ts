import {PaletteItemResponseDTO, PaletteItemType} from "@/types/palette.types";
import {create} from "zustand";
import {paletteItems} from "@/constants/palette";
import {toast} from "sonner";
import {buildComponentCreateDTO, buildComponentTree} from "@/lib/buildComponentTree";
import transformElements from "@/lib/transformElements";


type PaletteState = {
  paletteItems: PaletteItemType[];
  addPaletteItem: (paletteItem: PaletteItemType) => void;
  loadPaletteItems: () => Promise<void>;
  createPaletteItem: (paletteItem: PaletteItemType) => Promise<void>;
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

      if (!res.ok) throw new Error("Ошибка при получении данных с сервера");

      const json: PaletteItemType[] = await res.json();

      set({
        paletteItems: [...get().paletteItems, ...json]
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

      const paletteItemCreateDTO = {
        name: paletteItem.label,
        type: paletteItem.type,
        components: buildComponentCreateDTO(paletteItem.template)
      };

      console.log(paletteItemCreateDTO);

      const res = await fetch("/api/editor/palette/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(paletteItemCreateDTO),
      });

      if (!res.ok) throw new Error("Ошибка при получении данных с сервера");

      const paletteItemResponse: PaletteItemResponseDTO = await res.json();

      console.log(paletteItemResponse)

      const newPaletteItem: PaletteItemType = {
        id: paletteItemResponse.id,
        label: paletteItemResponse.name,
        type: paletteItemResponse.type,
        template: transformElements(paletteItemResponse.components)
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

