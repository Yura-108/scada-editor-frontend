import {confirmModal} from "@/components/ui/ConfirmModal";
import {hasUnsavedWork} from "../../../model/editorStoreInternals";

/**
 * Спросить, можно ли бросить несохранённые правки, перед сменой проекта или созданием схемы:
 * оба выбрасывают документ открытой схемы. Без правок — сразу «да».
 */
export async function confirmDropUnsaved(question: string, confirmLabel: string): Promise<boolean> {
  if (!hasUnsavedWork()) return true;
  return confirmModal({
    title: "Схема не сохранена",
    description: `${question} Несохранённые изменения будут потеряны.`,
    confirmLabel,
    danger: true,
  });
}
