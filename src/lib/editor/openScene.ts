import {hasUnsavedWork, useEditorStore} from "@/modules/editor";
import {usePaletteStore} from "@/store/usePaletteStore";
import {confirmModal} from "@/components/ui/ConfirmModal";

/**
 * Загружает схему, спросив подтверждение при несохранённых правках.
 *
 * Единственный вход для смены схемы: и список схем редактора, и вкладки быстрого доступа.
 * Раньше смена схемы шла только через модалку выбора и молча теряла несохранённую работу —
 * с вкладками, где переключение стоит один клик, промахнуться стало заметно легче.
 *
 * @returns переключились ли на запрошенную схему.
 */
export async function openSceneGuarded(id: number): Promise<boolean> {
  const {scene, loadScene} = useEditorStore.getState();

  // Уже открыта — переключать нечего, и спрашивать не о чем.
  if (scene?.id === id) return true;

  // `hasUnsavedWork` уже учитывает просмотр версии: там isDirty описывает версию на
  // холсте, а реальные правки лежат в стеше.
  if (hasUnsavedWork()) {
    const ok = await confirmModal({
      title: "Схема не сохранена",
      description: "Перейти к другой схеме? Несохранённые изменения будут потеряны.",
      confirmLabel: "Перейти",
      danger: true,
    });
    if (!ok) return false;
  }

  await loadScene(id);
  // Палитра зависит от проекта и подгружается вместе со схемой.
  await usePaletteStore.getState().loadPaletteItems();
  return true;
}
