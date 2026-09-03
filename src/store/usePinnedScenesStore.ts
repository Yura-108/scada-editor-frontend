import {create} from "zustand";
import {MAX_PINS, PinnedScene, readPinnedScenes, writePinnedScenes} from "@/lib/editor/pinnedScenes";
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
  /** Закреплённые схемы ТЕКУЩЕГО проекта, в порядке закрепления. */
  pins: PinnedScene[];
  /** Перечитать список под текущий проект (и очистить, когда проекта нет). */
  hydrate: () => void;
  togglePin: (scene: PinnedScene) => void;
  unpin: (sceneId: number) => void;
}

const currentProjectId = (): number | null => useEditorStore.getState().currentProject?.id ?? null;

/** Сохраняет список и кладёт его в стор одним движением. */
const commit = (set: (partial: Pick<PinnedScenesState, "pins">) => void, pins: PinnedScene[]) => {
  writePinnedScenes(currentProjectId(), pins);
  set({pins});
};

export const usePinnedScenesStore = create<PinnedScenesState>((set, get) => ({
  pins: [],

  hydrate: () => {
    const projectId = currentProjectId();
    set({pins: projectId == null ? [] : readPinnedScenes(projectId)});
  },

  togglePin: (scene) => {
    if (currentProjectId() == null) return;

    const {pins} = get();
    if (pins.some(p => p.id === scene.id)) {
      commit(set, pins.filter(p => p.id !== scene.id));
      return;
    }

    if (pins.length >= MAX_PINS) {
      toast.error(`Можно закрепить не больше ${MAX_PINS} схем`);
      return;
    }
    // Новая — в конец: порядок закрепления и есть порядок вкладок.
    commit(set, [...pins, {id: scene.id, name: scene.name}]);
  },

  unpin: (sceneId) => {
    const {pins} = get();
    if (!pins.some(p => p.id === sceneId)) return;
    commit(set, pins.filter(p => p.id !== sceneId));
  },
}));
