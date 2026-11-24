import {useDeviceLocksStore} from "@/core/devices";
import {useUnsavedGuard} from "@/shared/lib/unsavedGuard";
import {choiceModal, confirmModal} from "@/shared/ui/dialog/confirmModal";

/**
 * Несохранённые правки параметров при выходе из правки и из раздела.
 *
 * Черновик переживает и то и другое (он в `localStorage`), но без блокировки узла его уже не
 * сохранить: раньше «Закончить редактирование» молча оставляла правку с меткой «Изменено», а
 * переход по шапке не спрашивал ничего. Теперь оба спрашивают «Сохранить / Не сохранять /
 * Остаться», «Не сохранять» черновик выбрасывает.
 */
export function useParamDraftGuard({selectedDevice, deviceTitle, isEditingSelected, hasChanges, handleSave, discardChanges}: {
  selectedDevice: string | null;
  deviceTitle: string | undefined;
  isEditingSelected: boolean;
  hasChanges: boolean;
  handleSave: () => Promise<boolean>;
  discardChanges: () => void;
}) {
  const label = () => `параметры «${deviceTitle ?? selectedDevice ?? ""}»`;

  useUnsavedGuard("channels-params", {
    label,
    isDirty: () => hasChanges,
    save: handleSave,
    discard: discardChanges,
  });

  /** «Начать / Закончить редактирование»: выход из правки с несохранённым — через вопрос. */
  const toggleEditing = async () => {
    if (!selectedDevice) return;
    if (isEditingSelected && hasChanges) {
      const choice = await choiceModal({
        title: "Есть несохранённые изменения",
        description: `Не сохранены ${label()}. Без режима правки сохранить их будет нельзя.`,
        options: [
          {id: "save", label: "Сохранить и закончить"},
          {id: "discard", label: "Не сохранять", description: "Изменения пропадут", danger: true},
        ],
        cancelLabel: "Остаться",
      });
      if (choice === null) return;
      if (choice === "save" && !(await handleSave())) return;
      if (choice === "discard") discardChanges();
    }
    await useDeviceLocksStore.getState().toggleEditing(selectedDevice);
  };

  /** «Отменить изменения»: с подтверждением — вернуть значения можно только руками. */
  const confirmDiscard = async () => {
    const ok = await confirmModal({
      title: "Отменить изменения?",
      description: `В полях снова будут значения с сервера: ${label()}.`,
      confirmLabel: "Отменить изменения",
      cancelLabel: "Оставить",
      danger: true,
    });
    if (ok) discardChanges();
  };

  return {toggleEditing, confirmDiscard};
}
