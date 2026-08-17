import {PaletteItemResponseDTO, PaletteItemType} from "@/types/palette.types";
import {create} from "zustand";
import {paletteItems as paletteItemsStatic} from "@/constants/palette";
import {toast} from "sonner";
import {buildPaletteComponentTree} from "@/lib/buildComponentTree";
import transformElements from "@/lib/transformElements";
import {DiagramElement} from "@/types/editorElement.type";
import {isSaveConflictBody, SaveConflictError} from "@/types/editorVersion.types";

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

/**
 * Разбирает ответ и бросает ошибку с сообщением бэкенда, если статус не 2xx.
 *
 * Без этой проверки тело ошибки 4xx/5xx парсилось как обычный DTO и попадало в
 * список палитры записью с `id: undefined`, а пользователь видел «успешно».
 *
 * 409 выделен отдельным типом ошибки: расхождение версий — не сбой сохранения, а
 * ситуация, в которой решает человек, и показывать её надо сравнением, а не тостом.
 */
const parseOk = async <T>(res: Response, fallback: string): Promise<T> => {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // не-JSON — сообщение возьмём из текста
  }

  if (res.status === 409 && isSaveConflictBody(body)) {
    throw new SaveConflictError(body);
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && typeof (body as {message?: unknown}).message === "string"
        ? (body as {message: string}).message
        : "") || text.slice(0, 200) || `${fallback} (${res.status})`;
    throw new Error(message);
  }

  return body as T;
};

/**
 * Сообщает о расхождении версий шаблона.
 *
 * Отдельного диалога у шаблонов нет намеренно: слияния для них не будет (у DTO
 * шаблона нет id на вложенных уровнях, переименование неотличимо от «удалили плюс
 * создали»), список расхождений не придёт, и показывать было бы нечего. Разрешение
 * одно — перечитать список и повторить правку от свежей версии.
 */
const reportTemplateConflict = (err: SaveConflictError) => {
  const {base_version, current_version} = err.conflict;
  toast.error("Шаблон изменил другой пользователь", {
    description:
      `Вы правили версию ${base_version ?? "—"}, на сервере уже ${current_version ?? "—"}. ` +
      "Обновите список шаблонов и повторите правку.",
    duration: 12_000,
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

      const json = await parseOk<PaletteItemResponseDTO[]>(res, "Ошибка загрузки списка элементов");

      const paletteItems: PaletteItemType[] = (json ?? []).map(item => {
        const components = transformElements([item.rootComponent]);
        return {
          id: item.id,
          type: 'custom',
          name: item.name,
          category: item.type,
          defaultProps: {},
          template: components,
          versionNo: item.version_no ?? null,
        }
      });

      set({
        paletteItems: [...paletteItemsStatic, ...paletteItems]
      });
      // Успешный тост здесь не нужен: загрузка идёт при каждом монтировании
      // редактора и после каждого createScene — получался спам.
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
        // У шаблона тело и так объект — конверта нет, поля версионирования едут рядом.
        // Новый шаблон версий не имеет, based_on_version не отправляем.
        save_kind: "MANUAL",
      };

      const res = await fetch("/api/editor/palette/", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(paletteItemCreateDTO),
      });


      const paletteItemResponse = await parseOk<PaletteItemResponseDTO>(res, "Ошибка сохранения шаблона");

      const newPaletteItem: PaletteItemType = {
        id: paletteItemResponse.id,
        name: paletteItemResponse.name,
        type: 'custom',
        category: paletteItemResponse.type,
        defaultProps: paletteItem.defaultProps,
        template: transformElements([paletteItemResponse.rootComponent]),
        versionNo: paletteItemResponse.version_no ?? null,
      }
      set({
        paletteItems: [...get().paletteItems, newPaletteItem]
      });
      toast.success("Шаблон сохранён");
    } catch (err: any) {
      console.error(err);
      if (err instanceof SaveConflictError) return reportTemplateConflict(err);
      toast.error(err.message || "Ошибка сохранения шаблона");
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

      // База — версия, на которой пользователь правил шаблон. Берём из списка, а не
      // из аргумента: вызывающий передаёт Omit<PaletteItemType,'id'> из формы, где
      // версии нет, и подставить туда её значило бы просить UI помнить о контракте.
      const basedOnVersion = paletteItem.versionNo ?? get().paletteItems.find(i => i.id === id)?.versionNo;

      const paletteItemUpdateDTO = {
        name: paletteItem.name,
        type: paletteItem.category,
        rootComponent,
        save_kind: "MANUAL",
        // Версий нет — это первое сохранение шаблона, поле не отправляем вовсе.
        ...(basedOnVersion != null ? {based_on_version: basedOnVersion} : {}),
      };

      const res = await fetch(`/api/editor/palette/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(paletteItemUpdateDTO),
      });

      const paletteItemResponse = await parseOk<PaletteItemResponseDTO>(res, "Ошибка обновления шаблона");

      const updatedPaletteItem: PaletteItemType = {
        id: paletteItemResponse.id,
        name: paletteItemResponse.name,
        type: 'custom',
        category: paletteItemResponse.type,
        defaultProps: paletteItem.defaultProps,
        template: transformElements([paletteItemResponse.rootComponent]),
        // Ответ без version_no (старый контракт) не должен затирать известную версию.
        versionNo: paletteItemResponse.version_no ?? basedOnVersion ?? null,
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
      if (err instanceof SaveConflictError) return reportTemplateConflict(err);
      toast.error(err.message || "Ошибка обновления шаблона");
    }
  },
  deletePaletteItem: async (id) => {
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

