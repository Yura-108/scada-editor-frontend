import {hasUnsavedWork} from "./editorStoreInternals";
import {useEditorStore} from "./editorStore";
import {usePaletteStore} from "@/store/usePaletteStore";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import type {EditorProject} from "@/core/project";

/**
 * Загружает схему, спросив подтверждение при несохранённых правках.
 *
 * Единственный вход для смены схемы: и модалка выбора, и вкладки быстрого доступа.
 * Раньше смена схемы шла только через модалку и молча теряла несохранённую работу —
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

/**
 * Делает проект текущим, спросив подтверждение при несохранённых правках.
 *
 * `setCurrentProject` разрушительный: закрывает схему, стирает элементы и историю отмены.
 * Раньше окно проектов звало его без вопроса — смена проекта молча теряла работу, а выбор
 * уже открытого проекта закрывал его схему. Теперь текущий проект не трогается вовсе.
 *
 * @returns текущий ли теперь этот проект (false — пользователь передумал).
 */
export async function selectProjectGuarded(
  project: EditorProject,
  opts?: {skipSceneFetch?: boolean},
): Promise<boolean> {
  const {currentProject, setCurrentProject, loadSceneList} = useEditorStore.getState();
  if (currentProject?.id === project.id) return true;

  if (hasUnsavedWork()) {
    const ok = await confirmModal({
      title: "Схема не сохранена",
      description: "Перейти к другому проекту? Несохранённые изменения будут потеряны.",
      confirmLabel: "Перейти",
      danger: true,
    });
    if (!ok) return false;
  }

  // setCurrentProject сбрасывает sceneList в [] — сцены прошлого проекта не утекут.
  setCurrentProject(project);
  // У только что созданного проекта схем нет: для «пустого» project_id бэкенд может
  // вернуть чужие сцены, поэтому список не запрашиваем.
  if (!opts?.skipSceneFetch) await loadSceneList(project.id);
  return true;
}

/**
 * Создаёт схему, спросив подтверждение при несохранённых правках: новая схема встаёт на
 * место открытой, а её элементы и история отмены стираются. Раньше кнопка «Создать схему»
 * делала это без вопроса. Имя спрашивает сама `createScene` — уже после подтверждения.
 */
export async function createSceneGuarded(): Promise<void> {
  if (hasUnsavedWork()) {
    const ok = await confirmModal({
      title: "Схема не сохранена",
      description: "Создать новую схему? Несохранённые изменения в открытой будут потеряны.",
      confirmLabel: "Создать",
      danger: true,
    });
    if (!ok) return;
  }

  const created = await useEditorStore.getState().createScene();
  // Палитра зависит от проекта и подгружается вместе со схемой.
  if (created) await usePaletteStore.getState().loadPaletteItems();
}
