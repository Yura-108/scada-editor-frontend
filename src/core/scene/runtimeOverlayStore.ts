import {create} from "zustand";

/**
 * Рантайм-слой поверх документа сцены: то, что монитор рисует по живым значениям тегов.
 *
 * Отдельный стор, а не поля useEditorStore: кадры телеметрии идут часто, и каждый `set()`
 * в сторе редактора заставлял пересчитывать селекторы всех его подписчиков, хотя менялись
 * только значения на холсте. Здесь подписаны лишь узлы холста и оверлей «нет данных».
 *
 * Пишет только движок монитора (через `applyRuntimeBatch` / `clearRuntime` стора
 * редактора — переключения состояний остаются там, см. docs/domain/monitor.md).
 * В документ (`elements`), undo и автосейв ничего отсюда не попадает.
 */
interface RuntimeOverlayState {
  /**
   * Рантайм-оверрайды визуальных свойств (setProp из биндингов монитора).
   * Живут ПОВЕРХ state.overrides в getRenderedElement.
   */
  overridesByKey: Record<string, Record<string, unknown>>;
  /**
   * Ключи элементов, привязанных к тегу с quality != GOOD (или ещё не получавших
   * ни одного сообщения — холодный старт). Рисуется оверлеем «нет данных» поверх
   * готовой сцены (NoDataOverlay) — docs/contract/TAG_CONTRACT_CHANGES.md B2/B4.
   */
  noDataKeys: Set<string>;
  /**
   * Сливает патчи свойств в карту и заменяет набор «нет данных».
   * Если фактических изменений нет — set() не вызывается вовсе.
   */
  applyPatch: (patch: {
    propsByKey?: Record<string, Record<string, unknown>>;
    noDataKeys?: Set<string>;
  }) => void;
  /** Сброс оверрайдов при смене документа; набор «нет данных» ведёт движок. */
  resetOverrides: () => void;
  /** Полный сброс (выход из монитора). */
  clear: () => void;
}

export const useRuntimeOverlayStore = create<RuntimeOverlayState>()((set, get) => ({
  overridesByKey: {},
  noDataKeys: new Set(),

  applyPatch: ({propsByKey, noDataKeys}) => {
    const patch: Partial<RuntimeOverlayState> = {};

    if (propsByKey && Object.keys(propsByKey).length) {
      const prevMap = get().overridesByKey;
      let changed = false;
      const nextOverrides = {...prevMap};
      for (const [elementKey, props] of Object.entries(propsByKey)) {
        const prev = nextOverrides[elementKey] ?? {};
        if (Object.keys(props).some(k => !Object.is(prev[k], props[k]))) {
          nextOverrides[elementKey] = {...prev, ...props};
          changed = true;
        }
      }
      if (changed) patch.overridesByKey = nextOverrides;
    }

    // Движок уже присылает только изменившийся набор (diff внутри useRuntimeEngine),
    // здесь достаточно просто заменить.
    if (noDataKeys) patch.noDataKeys = noDataKeys;

    if (Object.keys(patch).length) set(patch);
  },

  resetOverrides: () => set({overridesByKey: {}}),

  clear: () => set({overridesByKey: {}, noDataKeys: new Set()}),
}));
