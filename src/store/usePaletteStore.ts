import {PaletteItemType} from "@/types/palette.types";
import {create} from "zustand";
import {paletteItems} from "@/constants/palette";
import {toast} from "sonner";


type PaletteState = {
  paletteItems: PaletteItemType[];
  loadPaletteItems: () => Promise<void>;
  addPaletteItem: (paletteItem: PaletteItemType) => void;
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
}))

