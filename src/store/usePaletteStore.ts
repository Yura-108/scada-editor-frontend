import {PaletteItemResponseDTO, PaletteItemType} from "@/types/palette.types";
import {create} from "zustand";
import {paletteItems as paletteItemsStatic} from "@/constants/palette";
import {toast} from "sonner";
import {buildPaletteComponentTree} from "@/lib/buildComponentTree";
import transformElements from "@/lib/transformElements";
import {DiagramElement} from "@/types/editorElement.type";

/**
 * Нормализует шаблон перед сохранением в палитру.
 * Шаблон НЕ привязан к конкретной сцене, поэтому:
 *   - корневой элемент получает parentId=null, parentKey=null
 *   - все остальные элементы получают parentId=null (children не существуют
 *     на бэкенде отдельно от корня шаблона; их parentKey ссылается на
 *     локальный ключ элемента внутри дерева шаблона и не трогается).
 */
const normalizeTemplateForPalette = (
  template: DiagramElement[],
  rootKey: string | undefined,
): DiagramElement[] => {
  return template.map(el => {
    if (el.key === rootKey) {
      return {...el, parentId: null, parentKey: null};
    }
    return {...el, parentId: null};
  });
};

type PaletteState = {
  paletteItems: PaletteItemType[];
  addPaletteItem: (paletteItem: PaletteItemType) => void;
  loadPaletteItems: () => Promise<void>;
  createPaletteItem: (paletteItem: Omit<PaletteItemType, 'id'>) => Promise<void>;
  updatePaletteItem: (id: number, paletteItem: Omit<PaletteItemType, 'id'>) => Promise<void>;
  deletePaletteItem: (id: number) => Promise<void>;
  deletePaletteCategory: (category: string) => Promise<void>;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  paletteItems: paletteItemsStatic,
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
        paletteItems: [...paletteItemsStatic, ...paletteItems]
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
      const normalizedTemplate = normalizeTemplateForPalette(paletteItem.template, rootElementKey);
      const rootComponent = buildPaletteComponentTree(normalizedTemplate, rootElementKey);

      if (!rootComponent) {
        toast.error("Не удалось собрать корневой компонент шаблона");
        return;
      }

      const paletteItemCreateDTO = {
        name: paletteItem.name,
        type: paletteItem.category,
        rootComponent,
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
  },
  updatePaletteItem: async (id, paletteItem) => {
    try {
      if (!paletteItem.template) return;
      const rootElementKey = paletteItem.template.find(el => el.type === 'group')?.key;
      const normalizedTemplate = normalizeTemplateForPalette(paletteItem.template, rootElementKey);
      const rootComponent = buildPaletteComponentTree(normalizedTemplate, rootElementKey);

      if (!rootComponent) {
        toast.error("Не удалось собрать корневой компонент шаблона");
        return;
      }

      const paletteItemUpdateDTO = {
        name: paletteItem.name,
        type: paletteItem.category,
        rootComponent,
      };

      const res = await fetch(`/api/editor/palette/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(paletteItemUpdateDTO),
      });

      const paletteItemResponse: PaletteItemResponseDTO = await res.json();

      const updatedPaletteItem: PaletteItemType = {
        id: paletteItemResponse.id,
        name: paletteItemResponse.name,
        type: 'custom',
        category: paletteItemResponse.type,
        defaultProps: paletteItem.defaultProps,
        template: transformElements([paletteItemResponse.rootComponent])
      }

      // Обновляем элемент в списке
      set({
        paletteItems: get().paletteItems.map(item =>
          item.id === id ? updatedPaletteItem : item
        )
      });

      toast.success("Шаблон успешно обновлен");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ошибка обновления шаблона");
    }
  },
  deletePaletteItem: async (id) => {
    console.log('DELETE PALETTE ITEM', id);
    try {
      const res = await fetch(`/api/editor/palette/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => {});
        throw new Error(err?.error || "Ошибка удаления");
      }
      set({ paletteItems: get().paletteItems.filter(item => item.id !== id) });
      toast.success("Шаблон удалён");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ошибка удаления шаблона");
    }
  },
  deletePaletteCategory: async (category) => {
    const items = get().paletteItems.filter(item => item.category === category);
    let failed = 0;
    for (const item of items) {
      try {
        const res = await fetch(`/api/editor/palette/${item.id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => {});
          throw new Error(err?.error || "Ошибка удаления");
        }
        set({ paletteItems: get().paletteItems.filter(i => i.id !== item.id) });
      } catch (err: any) {
        console.error(err);
        failed++;
      }
    }
    if (failed === 0) toast.success(`Группа «${category}» удалена`);
    else toast.error(`Удалено с ошибками: ${failed} из ${items.length}`);
  },
}))

