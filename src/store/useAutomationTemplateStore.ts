import {create} from "zustand";
import {toast} from "sonner";
import {
  createTemplate as createTemplateRequest,
  deleteTemplate as deleteTemplateRequest,
  fetchTemplates,
  updateTemplate as updateTemplateRequest,
} from "@/lib/automation/automationTemplatesApi";
import type {AutomationTaskTemplate} from "@/types/automationTemplate.types";

/**
 * Палитра шаблонов задач — общая для всех проектов, поэтому живёт в сторе, а не в состоянии
 * страницы: её читают и панель, и форма шаблона.
 *
 * Сохранение и правка **пробрасывают ошибку наверх**: форме нужны `errors[]`, чтобы подсветить
 * поле (занятое имя, кривой алиас) и дать исправить, не закрывая модалку. Тостом такое не
 * покажешь. Удаление, наоборот, вызывается из панели — там тост и есть весь ответ.
 */

type Status = "idle" | "loading" | "ready" | "error";

interface AutomationTemplateState {
  items: AutomationTaskTemplate[];
  status: Status;
  error: string | null;
  /** Грузит один раз за сессию страницы; повторные вызовы при монтировании ничего не стоят. */
  loadTemplates: () => Promise<void>;
  /** Принудительная перечитка — после правки и по кнопке «Повторить». */
  reload: () => Promise<void>;
  createTemplate: (template: Omit<AutomationTaskTemplate, "id">) => Promise<AutomationTaskTemplate>;
  updateTemplate: (
    id: number,
    template: Omit<AutomationTaskTemplate, "id">,
  ) => Promise<AutomationTaskTemplate>;
  deleteTemplate: (id: number) => Promise<void>;
}

export const useAutomationTemplateStore = create<AutomationTemplateState>((set, get) => ({
  items: [],
  status: "idle",
  error: null,

  loadTemplates: async () => {
    // «error» тоже конечное состояние: повторную попытку делает reload по кнопке, иначе
    // недоступный бэкенд ловил бы запрос на каждый рендер панели.
    if (get().status !== "idle") return;
    await get().reload();
  },

  reload: async () => {
    set({status: "loading", error: null});
    try {
      const items = await fetchTemplates();
      set({items, status: "ready", error: null});
      // Успешный тост не нужен: загрузка идёт при каждом открытии страницы.
    } catch (err) {
      const message = (err as Error).message || "Не удалось загрузить шаблоны задач";
      console.error(err);
      set({items: [], status: "error", error: message});
    }
  },

  createTemplate: async template => {
    const created = await createTemplateRequest(template);
    // Порядок в списке задаёт сервер (ORDER BY name) — перечитываем, а не угадываем позицию.
    await get().reload();
    toast.success(`Шаблон «${created.name}» сохранён`);
    return created;
  },

  updateTemplate: async (id, template) => {
    const saved = await updateTemplateRequest(id, template);
    await get().reload();
    toast.success(`Шаблон «${saved.name}» обновлён`);
    return saved;
  },

  deleteTemplate: async id => {
    try {
      await deleteTemplateRequest(id);
      set({items: get().items.filter(item => item.id !== id)});
      toast.success("Шаблон удалён");
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Не удалось удалить шаблон");
      // Кто-то удалил шаблон раньше нас — список на экране уже врёт.
      await get().reload();
    }
  },
}));
