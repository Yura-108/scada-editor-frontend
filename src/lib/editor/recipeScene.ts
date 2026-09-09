import {hasUnsavedWork, useEditorStore} from "@/store/useEditorStore";
import {openSceneGuarded} from "@/lib/editor/openScene";
import {confirmModal} from "@/components/ui/ConfirmModal";

/**
 * Сцена «Рецепты» — одна на проект: все таблицы-рецепты живут только на ней.
 *
 * Опознаём по ИМЕНИ. Дискриминатора у сцены нет: поле `SceneType.type` в DTO существует, но
 * фронтом не читается нигде, а `POST /api/editor/scene` умеет слать только `{name, project_id}` —
 * задать тип, не трогая бэкенд, нечем.
 */
export const RECIPES_SCENE_NAME = "Рецепты";

/**
 * Приводит редактор на сцену «Рецепты» проекта, заводя её при необходимости.
 *
 * @returns id сцены или null, если перейти не удалось (нет проекта, пользователь отказался
 *          терять несохранённые правки, сцена не создалась).
 */
export async function ensureRecipesScene(): Promise<number | null> {
  const {scene, sceneList, currentProject, createScene} = useEditorStore.getState();

  if (!currentProject) {
    return null;
  }

  // Имена сцен не уникальны (в базе уже есть «Dimka» и «dimka» в одном проекте) —
  // берём первое совпадение; сравнение по trim(), без игр с регистром.
  const existing = sceneList.find(s => s.name.trim() === RECIPES_SCENE_NAME);

  if (existing) {
    // Уже открыта — ни спрашивать, ни перезагружать нечего.
    if (scene?.id === existing.id) return existing.id;
    // openSceneGuarded сам предупредит про несохранённые правки.
    return (await openSceneGuarded(existing.id)) ? existing.id : null;
  }

  // `createScene`, в отличие от `openSceneGuarded`, НЕ спрашивает про несохранённую работу:
  // он просто подменяет `scene` и чистит `elements`. Спрашиваем здесь сами, тем же текстом.
  if (hasUnsavedWork()) {
    const ok = await confirmModal({
      title: "Схема не сохранена",
      description: `Перейти на сцену «${RECIPES_SCENE_NAME}»? Несохранённые изменения будут потеряны.`,
      confirmLabel: "Перейти",
      danger: true,
    });
    if (!ok) return null;
  }

  const created = await createScene(RECIPES_SCENE_NAME);
  return created?.id ?? null;
}
