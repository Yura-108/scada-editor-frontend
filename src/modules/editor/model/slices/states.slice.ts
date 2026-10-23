import {DiagramElement} from "@/types/editorElement.type";
import {getElementIndex} from "@/lib/editor/elementIndex";
import {findStateNameRefs, renameStateNameInCode, type StateNameRef} from "@/lib/editor/stateNameRefs";
import {createUuid} from "@/shared/lib/createUuid";
import {useRuntimeOverlayStore} from "@/core/scene";
import type {EditorState} from "../editorStore";
import {getDescendantKeys} from "../elementTree";
import {cascadeStateByName, ensureStateByName} from "../elementStates";

/**
 * Зона «Состояния» документа стора редактора. Активное состояние элементов, добавление, удаление и
 * переименование состояний по поддереву, применение рантайм-батча монитора.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6). Добавление, удаление и
 * переименование состояний правят `elements` — идут в undo и в сохранение; активное состояние
 * (`currentComponentStateByElementKey`) и рантайм-батч монитора — нет. Код перенесён без изменений.
 */
export interface StatesSlice {
  currentComponentStateByElementKey: Record<string, string>;
  setCurrentComponentStateId: (elementKey: string, componentState: string) => void;
  clearCurrentComponentStateId: (elementKey: string) => void;

  /**
   * Применяет батч рантайм-изменений: переключения состояний (по ИМЕНИ, с каскадом
   * на поддерево) — здесь, патчи визуальных свойств и набор «нет данных» — в
   * `useRuntimeOverlayStore` (core/scene). Оба set() идут подряд синхронно, React
   * сводит их в одну перерисовку. Без фактических изменений set() не вызывается.
   */
  applyRuntimeBatch: (batch: {
    stateNameByKey?: Record<string, string>;
    propsByKey?: Record<string, Record<string, unknown>>;
    noDataKeys?: Set<string>;
  }) => void;
  /** Сброс всех рантайм-карт (выход из монитора). */
  clearRuntime: () => void;
  addComponentStateToSubtree: (elementKey: string, stateName: string) => string | null;
  removeComponentStateFromSubtree: (elementKey: string, stateName: string) => void;
  /**
   * Переименование состояния каскадом по поддереву. `rewriteCode` — заодно переписать
   * литералы `setState("старое")` в биндингах и обработчиках событий поддерева.
   */
  renameComponentStateInSubtree: (
    elementKey: string,
    oldName: string,
    newName: string,
    opts?: {rewriteCode?: boolean},
  ) => void;
  /** Read-only: где в коде поддерева упомянуто имя состояния (для диалога переименования). */
  findStateUsages: (elementKey: string, stateName: string) => StateNameRef[];
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createStatesSlice = (set: EditorSet, get: () => EditorState): StatesSlice => ({
  currentComponentStateByElementKey: {},

  addComponentStateToSubtree: (elementKey, stateName) => {
    let rootStateId: string | null = null;

    set(state => {
      const root = state.elements.find(el => el.key === elementKey);
      if (!root) return {};

      const existingRootState = root.states.find(s => s.name === stateName);
      rootStateId = existingRootState?.id ?? createUuid();

      // Потомки (children + composition) есть не только у групп, но и у complex-компонентов
      // (button/custom); для листа getDescendantKeys вернёт пустой список.
      const keysToUpdate = [elementKey, ...getDescendantKeys(elementKey, state.elements)];

      return {
        elements: state.elements.map(el => keysToUpdate.includes(el.key)
          ? ensureStateByName(el, stateName, el.key === elementKey ? rootStateId ?? undefined : undefined)
          : el
        ),
      };
    });

    return rootStateId;
  },
  // Удаление состояния каскадом по имени — симметрично добавлению: убираем
  // состояние с этим именем у корня и всех потомков (children + composition).
  // Состояние по умолчанию удалить нельзя. Указатели текущего состояния,
  // смотревшие на удалённое, сбрасываются на состояние по умолчанию.
  removeComponentStateFromSubtree: (elementKey, stateName) => {
    set(state => {
      const root = state.elements.find(el => el.key === elementKey);
      if (!root) return {};

      // Нельзя удалить дефолтное состояние (и несуществующее — нечего удалять).
      const target = root.states.find(s => s.name === stateName);
      if (!target || target.isDefault) return {};

      const keysToUpdate = new Set(
        [elementKey, ...getDescendantKeys(elementKey, state.elements)]
      );

      // id удаляемых состояний по всему поддереву — чтобы сбросить указатели.
      const removedStateIds = new Set<string>();
      for (const el of state.elements) {
        if (!keysToUpdate.has(el.key)) continue;
        for (const s of el.states) {
          if (s.name === stateName && !s.isDefault) removedStateIds.add(s.id);
        }
      }

      const nextElements = state.elements.map(el => {
        if (!keysToUpdate.has(el.key)) return el;
        // Дефолтное состояние с тем же именем не трогаем (страховка).
        const filtered = el.states.filter(s => s.name !== stateName || s.isDefault);
        if (filtered.length === el.states.length) return el;

        return {...el, states: filtered} as DiagramElement;
      });

      // Сброс указателей текущего состояния на дефолт там, где смотрели на удалённое.
      const {byKey} = getElementIndex(nextElements);
      const nextCurrent = {...state.currentComponentStateByElementKey};
      let currentChanged = false;
      for (const [key, stateId] of Object.entries(nextCurrent)) {
        if (!removedStateIds.has(stateId)) continue;
        const el = byKey[key];
        const fallback = el?.states.find(s => s.isDefault)?.id ?? el?.states[0]?.id;
        if (fallback) {
          nextCurrent[key] = fallback;
        } else {
          delete nextCurrent[key];
        }
        currentChanged = true;
      }

      return {
        elements: nextElements,
        ...(currentChanged ? {currentComponentStateByElementKey: nextCurrent} : {}),
      };
    });
  },
  /**
   * Места в пользовательском коде поддерева, где упомянуто имя состояния.
   *
   * Read-only: список нужен UI ДО мутации, чтобы спросить, переписывать ли код.
   * Живёт в сторе, потому что поддерево считает модульный `getDescendantKeys`.
   */
  findStateUsages: (elementKey, stateName) => {
    const {elements} = get();
    const subtreeKeys = new Set([elementKey, ...getDescendantKeys(elementKey, elements)]);
    return findStateNameRefs(elements, subtreeKeys, stateName);
  },
  /**
   * Переименование состояния каскадом по имени — симметрично добавлению и удалению.
   *
   * Имя состояния связывает поддерево: `cascadeStateByName` и `buildShapeDescriptor`
   * сопоставляют состояния родителя и потомков именно по нему. Переименовать только у
   * корня — значит увести потомков в состояние по умолчанию и запечь при сохранении
   * визуал не того состояния.
   *
   * `serverId`, `id`, `isDefault` и `overrides` сохраняются спредом: `serverId` —
   * единственное, по чему бэкенд отличает переименование от «удалили и создали заново»
   * (§2 контракта версий). `currentComponentStateByElementKey` не трогаем — карта по
   * `id`, а `id` не меняется.
   */
  renameComponentStateInSubtree: (elementKey, oldName, newName, opts) => {
    if (oldName === newName) return;

    set(state => {
      const root = state.elements.find(el => el.key === elementKey);
      if (!root || !root.states.some(s => s.name === oldName)) return {};

      const keysToUpdate = new Set([elementKey, ...getDescendantKeys(elementKey, state.elements)]);
      let changed = false;

      const nextElements = state.elements.map(el => {
        if (!keysToUpdate.has(el.key)) return el;

        const hasState = el.states.some(s => s.name === oldName);

        // Правка кода идёт тем же set() — один шаг undo на переименование целиком.
        // Клонируем ТОЛЬКО реально изменившиеся строки и возвращаем исходный массив,
        // если не изменилось ничего: иначе элемент с посторонними биндингами считался
        // бы изменённым и пачкал бы сцену на ровном месте.
        let bindings = el.bindings;
        let events = el.events;

        if (opts?.rewriteCode) {
          if (el.bindings?.length) {
            let touched = false;
            const next = el.bindings.map(b => {
              if (!b.code) return b;
              const code = renameStateNameInCode(b.code, oldName, newName);
              if (code === b.code) return b;
              touched = true;
              return {...b, code};
            });
            if (touched) bindings = next;
          }
          if (el.events?.length) {
            let touched = false;
            const next = el.events.map(e => {
              const code = e.handler?.code;
              if (!code) return e;
              const nextCode = renameStateNameInCode(code, oldName, newName);
              if (nextCode === code) return e;
              touched = true;
              return {...e, handler: {...e.handler, code: nextCode}};
            });
            if (touched) events = next;
          }
        }

        const codeChanged = bindings !== el.bindings || events !== el.events;

        if (!hasState && !codeChanged) return el;
        changed = true;

        return {
          ...el,
          ...(hasState
            ? {states: el.states.map(s => s.name === oldName ? {...s, name: newName} : s)}
            : {}),
          ...(bindings !== el.bindings ? {bindings} : {}),
          ...(events !== el.events ? {events} : {}),
        } as DiagramElement;
      });

      // Холостая правка не должна плодить новый массив: на его ссылке завязаны
      // equality истории undo и флаг несохранённых изменений.
      return changed ? {elements: nextElements} : {};
    });
  },
  // Каскад по имени состояния — для любого контейнера (группа или complex-компонент);
  // у листа потомков нет, каскад просто не сработает (см. cascadeStateByName).
  setCurrentComponentStateId: (elementKey, componentState) => set(state => ({
    currentComponentStateByElementKey: cascadeStateByName(
      state.elements,
      {...state.currentComponentStateByElementKey},
      elementKey,
      componentState,
    ),
  })),
  clearCurrentComponentStateId: (elementKey) => set(state => {
    const next = {...state.currentComponentStateByElementKey};
    delete next[elementKey];

    return {currentComponentStateByElementKey: next};
  }),
  applyRuntimeBatch: ({stateNameByKey, propsByKey, noDataKeys}) => {
    const state = get();
    const patch: Partial<EditorState> = {};

    // 1) Переключения состояний: имя → id на корне, каскад по имени на поддерево.
    if (stateNameByKey && Object.keys(stateNameByKey).length) {
      const {byKey} = getElementIndex(state.elements);
      const nextMap = {...state.currentComponentStateByElementKey};
      for (const [elementKey, stateName] of Object.entries(stateNameByKey)) {
        const el = byKey[elementKey];
        const stateId = el?.states.find(s => s.name === stateName)?.id;
        // Нет состояния с таким именем — интент биндинга не применим, пропускаем.
        if (!stateId) continue;
        cascadeStateByName(state.elements, nextMap, elementKey, stateId);
      }
      const changed = Object.keys(nextMap).some(
        k => nextMap[k] !== state.currentComponentStateByElementKey[k],
      );
      if (changed) patch.currentComponentStateByElementKey = nextMap;
    }

    // Ничего фактически не изменилось — не дёргаем ни стор, ни рендер.
    if (Object.keys(patch).length) set(patch);

    // 2) Патчи визуальных свойств и 3) набор «нет данных» (B2/B4) — в рантайм-слой,
    // elements не трогаем. Пустой патч там тоже не вызывает set().
    useRuntimeOverlayStore.getState().applyPatch({propsByKey, noDataKeys});
  },
  clearRuntime: () => {
    set({currentComponentStateByElementKey: {}});
    useRuntimeOverlayStore.getState().clear();
  },
});
