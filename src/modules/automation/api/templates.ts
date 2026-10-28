import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  updateTemplate,
} from "./templatesApi"; // переедет в модуль вместе с разделом (шаг 8)
import type {AutomationTaskTemplate} from "@/types/automationTemplate.types";

/**
 * Палитра шаблонов задач — общая для всех проектов, поэтому ключ без projectId.
 * Её читают и панель, и форма шаблона.
 */
export const templateKeys = {
  all: ["automation-templates"] as const,
};

type TemplateBody = Omit<AutomationTaskTemplate, "id">;

/**
 * Список шаблонов. Грузится один раз за сессию вкладки (`staleTime: Infinity`): повторное
 * открытие страницы ничего не стоит. Ошибка — конечное состояние, перечитка по «Повторить»
 * (`refetch`), иначе недоступный бэкенд ловил бы запрос на каждое монтирование панели.
 */
export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: fetchTemplates,
    staleTime: Infinity,
  });
}

/**
 * Создание и правка **пробрасывают ошибку наверх** (`mutateAsync`): форме нужны `errors[]`,
 * чтобы подсветить поле (занятое имя, кривой алиас) и дать исправить, не закрывая модалку.
 * Тостом такое не покажешь. Порядок в списке задаёт сервер (ORDER BY name) — поэтому
 * перечитываем, а не вставляем сами; промис мутации ждёт перечитки.
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (template: TemplateBody) => createTemplate(template),
    onSuccess: async created => {
      await queryClient.invalidateQueries({queryKey: templateKeys.all});
      toast.success(`Шаблон «${created.name}» сохранён`);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, template}: {id: number; template: TemplateBody}) => updateTemplate(id, template),
    onSuccess: async saved => {
      await queryClient.invalidateQueries({queryKey: templateKeys.all});
      toast.success(`Шаблон «${saved.name}» обновлён`);
    },
  });
}

/** Удаление вызывается из панели — там тост и есть весь ответ, ошибка наверх не идёт. */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<AutomationTaskTemplate[]>(
        templateKeys.all,
        items => items?.filter(item => item.id !== id),
      );
      toast.success("Шаблон удалён");
    },
    onError: async err => {
      console.error(err);
      toast.error(err.message || "Не удалось удалить шаблон");
      // Кто-то удалил шаблон раньше нас — список на экране уже врёт.
      await queryClient.invalidateQueries({queryKey: templateKeys.all});
    },
  });
}
