import {create} from "zustand";
import {
  MAX_PINS, PinnedScene, PinnedTabs, RECIPES_TAB_KEY, readPinnedTabs, writePinnedTabs,
} from "@/lib/editor/pinnedScenes";
import {useEditorStore} from "@/store/useEditorStore";
import {toast} from "sonner";

/**
 * Закреплённые схемы текущего проекта — панель быстрого доступа в полосе вкладок.
 *
 * Отдельный маленький стор, а не поле `useEditorStore`: это настройка рабочего места,
 * а не состояние документа. Реактивность здесь обязательна — скрепку жмут в модалке
 * выбора схемы, которую рендерит `ModalRoot` вне `WorkSpace`, а обновиться должна полоса
 * вкладок; сам localStorage об изменениях не сообщает.
 *
 * Идентификатор проекта действия читают из `useEditorStore` в момент вызова — тем же
 * приёмом, что и `openChooseSceneModal`.
 */
interface PinnedScenesState {
  /** Закреплённые схемы ТЕКУЩЕГО проекта, в порядке отображения. */
  pins: PinnedScene[];
  /** Место «Рецептов» в перетаскиваемом ряду: индекс вставки в `pins`. */
  recipesIndex: number;
  /** Перечитать список под текущий проект (и очистить, когда проекта нет). */
  hydrate: () => void;
  togglePin: (scene: PinnedScene) => void;
  unpin: (sceneId: number) => void;
  /**
   * Новый порядок после перетаскивания — списком КЛЮЧЕЙ вкладок
   * (`scene:{id}` и `recipes`). Один список вместо пары «массив + индекс»: ровно то,
   * что отдаёт dnd-kit, и рассинхронизировать эти две вещи между собой уже нечем.
   *
   * Ключа `recipes` может и не быть: в мониторе такой вкладки нет, и её место там
   * никто не задаёт — тогда прежний `recipesIndex` сохраняется как есть.
   */
  reorder: (orderedKeys: string[]) => void;
}

const currentProjectId = (): number | null => useEditorStore.getState().currentProject?.id ?? null;

/** Сохраняет порядок и кладёт его в стор одним движением. */
const commit = (
  set: (partial: Pick<PinnedScenesState, "pins" | "recipesIndex">) => void,
  tabs: PinnedTabs,
) => {
  writePinnedTabs(currentProjectId(), tabs);
  set(tabs);
};

export const usePinnedScenesStore = create<PinnedScenesState>((set, get) => ({
  pins: [],
  recipesIndex: 0,

  hydrate: () => {
    const projectId = currentProjectId();
    set(projectId == null ? {pins: [], recipesIndex: 0} : readPinnedTabs(projectId));
  },

  togglePin: (scene) => {
    if (currentProjectId() == null) return;

    const {pins, recipesIndex} = get();
    if (pins.some(p => p.id === scene.id)) {
      commit(set, {pins: pins.filter(p => p.id !== scene.id), recipesIndex});
      return;
    }

    if (pins.length >= MAX_PINS) {
      toast.error(`Можно закрепить не больше ${MAX_PINS} схем`);
      return;
    }
    // Новая — в конец ряда закреплённых, «Рецепты» остаются на своём месте.
    commit(set, {pins: [...pins, {id: scene.id, name: scene.name}], recipesIndex});
  },

  unpin: (sceneId) => {
    const {pins, recipesIndex} = get();
    if (!pins.some(p => p.id === sceneId)) return;
    commit(set, {pins: pins.filter(p => p.id !== sceneId), recipesIndex});
  },

  reorder: (orderedKeys) => {
    const {pins, recipesIndex} = get();

    const byKey = new Map<string, PinnedScene>(pins.map(p => [`scene:${p.id}`, p]));
    const nextPins: PinnedScene[] = [];
    let nextRecipesIndex = -1;

    for (const key of orderedKeys) {
      if (key === RECIPES_TAB_KEY) {
        nextRecipesIndex = nextPins.length;
        continue;
      }
      const pin = byKey.get(key);
      // Незнакомый ключ — гонка с откреплением: порядок пришёл от прошлого набора.
      if (!pin) return;
      nextPins.push(pin);
    }

    // Экран без вкладки «Рецепты» (монитор) её место не задаёт — сохраняем прежнее.
    // Клампить не нужно: перетаскивание меняет ПОРЯДОК, а не набор, поэтому длина
    // списка та же и старый индекс остаётся в границах.
    const keepRecipesIndex = nextRecipesIndex < 0 ? recipesIndex : nextRecipesIndex;

    // Состав обязан совпасть: перетаскивание меняет ПОРЯДОК, а не набор.
    if (nextPins.length !== pins.length) return;
    // Холостая перестановка не должна писать в хранилище и дёргать подписчиков.
    if (keepRecipesIndex === recipesIndex && nextPins.every((p, i) => p.id === pins[i].id)) return;

    commit(set, {pins: nextPins, recipesIndex: keepRecipesIndex});
  },
}));
