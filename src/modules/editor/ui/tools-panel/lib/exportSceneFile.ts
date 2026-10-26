import {toast} from "sonner";
import {downloadJson, safeFileName} from "@/shared/lib/downloadJson";
import {useEditorStore} from "../../../model/editorStore";

/** «Экспорт в файл»: схема конвертом нашего формата (`buildSceneExport`). */
export function exportSceneFile(): void {
  const {scene} = useEditorStore.getState();
  if (!scene) {
    toast.info("Сначала загрузите или создайте схему");
    return;
  }

  const file = useEditorStore.getState().buildSceneExport();
  if (!file.elements.length) {
    toast.info("Схема пуста — экспортировать нечего");
    return;
  }

  // Дата в имени: файл кладут «себе на компьютер», и через неделю их там несколько.
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(`${safeFileName(scene.name, "scheme")}_${stamp}.json`, file);
  toast.success(`Сохранено элементов: ${file.elements.length}`);
}
