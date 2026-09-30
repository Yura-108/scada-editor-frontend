import {create} from "zustand";
import {
  hasPinnedSettings, MAX_PINS, PINNED_SETTINGS_KEY, PinnedScene, PinnedTabs, pinsToSettings, RECIPES_TAB_KEY,
  readPinnedTabs, readPinsFromSettings, writePinnedTabs,
} from "@/lib/editor/pinnedScenes";
import {fetchProjectSettings, ProjectSettingsUnsupported, saveProjectSetting} from "@/lib/editor/projectSettingsApi";
import {useEditorStore} from "@/store/useEditorStore";
import {toast} from "sonner";

/**
 * Закреплённые схемы текущего проекта — панель быстрого доступа в полосе вкладок.
 *
 * Это общая настройка ПРОЕКТА (docs/contract/2026-09-30-project-image-contract.md): инженер
 * закрепляет и упорядочивает схемы в редакторе, и те же вкладки видят все — коллеги в редакторе и
 * операторы в мониторе. В мониторе список только читается. localStorage — кэш (вкладки сразу, до
 * ответа сервера) и запасной путь, пока бэкенд ручек настроек не знает (`supported: false`).
 *
 * Отдельный маленький стор, а не поле `useEditorStore`: это не состояние документа. Реактивность
 * обязательна — скрепку жмут в модалке выбора схемы, которую рендерит `ModalRoot` вне `WorkSpace`,
 * а обновиться должна полоса вкладок.
 *
 * Идентификатор проекта действия читают из `useEditorStore` в момент вызова — тем же
 * приёмом, что и `openChooseSceneModal`.
 */
interface PinnedScenesState {
  /** Закреплённые схемы ТЕКУЩЕГО проекта, в порядке отображения. */
  pins: PinnedScene[];
  /** Место «Рецептов» в перетаскиваемом ряду: индекс вставки в `pins`. */
  recipesIndex: number;
  /** false — бэкенд настроек проекта ещё не знает: закрепления личные, в localStorage. */
  supported: boolean;
  /**
   * Перечитать список под текущий проект (и очистить, когда проекта нет): сразу из кэша, затем
   * с сервера. Зовётся на смену проекта и на возврат во вкладку браузера — чтобы чужое
   * закрепление появилось без перезагрузки.
   */
  hydrate: () => void;
  togglePin: (scene: PinnedScene) => void;
  unpin: (sceneId: number) => void;
  /**
   * Новый порядок после перетаскивания — списком КЛЮЧЕЙ вкладок
   * (`scene:{id}` и `recipes`). Один список вместо пары «массив + индекс»: ровно то,
   * что отдаёт dnd-kit, и рассинхронизировать эти две вещи между собой уже нечем.
   *
   * Ключа `recipes` может и не быть — тогда прежний `recipesIndex` сохраняется как есть.
   */
  reorder: (orderedKeys: string[]) => void;
}

const currentProjectId = (): number | null => useEditorStore.getState().currentProject?.id ?? null;

/**
 * Менять закрепления можно только в редакторе: в мониторе (он рисует выпуск, `sceneSource =
 * "release"`) это общая настройка, которую оператор лишь видит.
 */
const canEditPins = (): boolean => useEditorStore.getState().sceneSource === "draft";

/** Номер последнего `hydrate`: ответ сервера на прошлый проект не должен лечь поверх нового. */
let hydrateSeq = 0;

/** Имя схемы для вкладки: из списка схем, иначе из кэша. */
const nameResolver = (cached: PinnedTabs) => (id: number): string | undefined =>
  useEditorStore.getState().sceneList.find(s => s.id === id)?.name
  ?? cached.pins.find(p => p.id === id)?.name;

/**
 * Кладёт порядок в стор и кэш, затем — на сервер. Сервер отказал — откат к прежнему списку:
 * иначе вкладки показывали бы закрепление, которого у остальных нет.
 */
const commit = (
  set: (partial: Partial<PinnedScenesState>) => void,
  get: () => PinnedScenesState,
  tabs: PinnedTabs,
) => {
  const projectId = currentProjectId();
  if (projectId == null) return;
  const previous: PinnedTabs = {pins: get().pins, recipesIndex: get().recipesIndex};
  writePinnedTabs(projectId, tabs);
  set(tabs);
  if (!get().supported) return;

  saveProjectSetting(projectId, PINNED_SETTINGS_KEY, pinsToSettings(tabs)).catch(err => {
    if (err instanceof ProjectSettingsUnsupported) {
      // Бэкенд откатили или ещё не обновили — дальше работаем локально, правка остаётся.
      set({supported: false});
      return;
    }
    console.error(err);
    if (currentProjectId() !== projectId) return;
    writePinnedTabs(projectId, previous);
    set(previous);
    toast.error("Не удалось сохранить закрепление для всех пользователей");
  });
};

export const usePinnedScenesStore = create<PinnedScenesState>((set, get) => ({
  pins: [],
  recipesIndex: 0,
  supported: true,

  hydrate: () => {
    const projectId = currentProjectId();
    const seq = ++hydrateSeq;
    if (projectId == null) {
      set({pins: [], recipesIndex: 0});
      return;
    }
    const cached = readPinnedTabs(projectId);
    set(cached);

    fetchProjectSettings(projectId)
      .then(settings => {
        if (seq !== hydrateSeq || currentProjectId() !== projectId) return;
        set({supported: true});
        if (!hasPinnedSettings(settings)) {
          // На сервере закреплений ещё нет — переезд со старой, личной схемы хранения: первый
          // инженер, открывший проект в редакторе, отдаёт свои локальные закрепления всем.
          if (canEditPins() && cached.pins.length) {
            void saveProjectSetting(projectId, PINNED_SETTINGS_KEY, pinsToSettings(cached))
              .catch(err => console.warn("[pins] не удалось перенести закрепления на сервер:", err));
          }
          return;
        }
        const tabs = readPinsFromSettings(settings, nameResolver(cached));
        writePinnedTabs(projectId, tabs);
        set(tabs);
      })
      .catch(err => {
        if (seq !== hydrateSeq) return;
        if (err instanceof ProjectSettingsUnsupported) {
          set({supported: false});
          return;
        }
        // Сеть или сервер: показываем кэш, это не повод для тоста.
        console.warn("[pins] не удалось загрузить закрепления проекта:", err);
      });
  },

  togglePin: (scene) => {
    if (currentProjectId() == null || !canEditPins()) return;

    const {pins, recipesIndex} = get();
    if (pins.some(p => p.id === scene.id)) {
      commit(set, get, {pins: pins.filter(p => p.id !== scene.id), recipesIndex});
      return;
    }

    if (pins.length >= MAX_PINS) {
      toast.error(`Можно закрепить не больше ${MAX_PINS} схем`);
      return;
    }
    // Новая — в конец ряда закреплённых, «Рецепты» остаются на своём месте.
    commit(set, get, {pins: [...pins, {id: scene.id, name: scene.name}], recipesIndex});
  },

  unpin: (sceneId) => {
    if (!canEditPins()) return;
    const {pins, recipesIndex} = get();
    if (!pins.some(p => p.id === sceneId)) return;
    commit(set, get, {pins: pins.filter(p => p.id !== sceneId), recipesIndex});
  },

  reorder: (orderedKeys) => {
    if (!canEditPins()) return;
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

    commit(set, get, {pins: nextPins, recipesIndex: keepRecipesIndex});
  },
}));
