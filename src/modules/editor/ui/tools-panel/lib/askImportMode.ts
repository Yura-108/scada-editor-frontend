import {choiceModal} from "@/components/ui/ConfirmModal";
import {useEditorStore} from "../../../model/editorStore";

export type ImportMode = "append" | "replace";

/**
 * Куда класть импорт: на пустую схему — заменой без вопросов, на непустую — спрашиваем.
 * Без вопроса повторный импорт того же листа молча удваивал схему, а замена была
 * недоступна вовсе. null — пользователь отказался.
 *
 * `description` — что лежит в файле, своими словами для каждого вида импорта.
 */
export async function askImportMode(description: string): Promise<ImportMode | null> {
  if (!useEditorStore.getState().elements.length) return "replace";

  const answer = await choiceModal({
    title: "На схеме уже есть элементы",
    description,
    options: [
      {
        id: "replace",
        label: "Заменить содержимое схемы",
        description: "Текущие элементы будут убраны. Отменяется через Ctrl+Z, на сервере — до ближайшего сохранения.",
        danger: true,
      },
      {
        id: "append",
        label: "Добавить к существующим",
        description: "Импортированное ляжет поверх текущего. Повторный импорт того же файла задвоит элементы.",
      },
    ],
  });
  return answer ? answer as ImportMode : null;
}
