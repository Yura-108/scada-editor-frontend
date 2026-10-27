import {useShallow} from "zustand/react/shallow";
import {useCurrentProjectGrant} from "@/lib/access/projectAccess";
import {openSceneGuarded} from "@/lib/editor/openScene";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useEditorStore} from "../../../model/editorStore";
import {confirmDropUnsaved} from "../lib/confirmDropUnsaved";

/** Список схем текущего проекта: выбор, создание. Закрепление и удаление — в строке. */
export function useScenePicker() {
  const {currentProject, scene, sceneList, createScene} = useEditorStore(useShallow(s => ({
    currentProject: s.currentProject, scene: s.scene, sceneList: s.sceneList, createScene: s.createScene,
  })));
  // Без права правки схемы только открываются: создать, удалить и закрепить нельзя.
  const canWrite = useCurrentProjectGrant().edit;

  // Через общий хелпер: он же спрашивает про несохранённые правки и используется
  // вкладками быстрого доступа — поведение двух входов не должно разъезжаться.
  const selectScene = (id: number) => { void openSceneGuarded(id); };

  /** @returns создана ли схема — по нему футер решает, очищать ли поле. */
  const create = async (name: string): Promise<boolean> => {
    // createScene сразу открывает новую схему и выбрасывает документ открытой.
    if (!await confirmDropUnsaved("Создать новую схему?", "Создать")) return false;
    // Ошибку createScene показывает сам.
    const created = await createScene(name);
    if (!created) return false;
    // Палитра зависит от проекта и подгружается вместе со схемой — как в openSceneGuarded.
    await usePaletteStore.getState().loadPaletteItems();
    return true;
  };

  const sceneId = scene?.id != null ? Number(scene.id) : null;

  return {currentProject, sceneId, sceneList, canWrite, selectScene, create};
}
