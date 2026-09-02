import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/store/useEditorStore";
import { getElementIndex } from "@/lib/editor/elementIndex";
import { DiagramElement, GroupElement } from "@/types/editorElement.type";
import { sortKeysByZIndex } from "@/lib/editor/zOrder";

/** Типы со своими специализированными ручками — Transformer к ним не цепляем. */
// Дуга — со своими ручками (начало/раствор/радиус), рамка Transformer'а ей не нужна:
// её масштабирование записало бы w/h в обход `radius`, который читает рендер.
export const NON_TRANSFORMABLE = new Set(["group", "text", "circle", "arc", "curve", "line", "polygon"]);

export interface ElementRenderState {
  /** Сам элемент (undefined — удалён из схемы). */
  el: DiagramElement | undefined;
  isSelected: boolean;
  /** Единственный выделенный и трансформируемый — рамку рисует SelectionTransformer. */
  isTransformerTarget: boolean;
  /** Это активная (открытая двойным кликом) группа. */
  isActiveGroup: boolean;
  /** Текст редактируется инлайн — Konva-текст прячется под textarea. */
  isEditing: boolean;
  /** Сфокусированная ячейка, если она принадлежит этому элементу. */
  focusedCell: { elementKey: string; row: number; col: number } | null;
  /**
   * Активное состояние элемента и рантайм-оверрайды монитора.
   *
   * Обязаны доехать до фигуры ПРОПАМИ: `ShapeElement` обёрнут в `React.memo`, а при
   * смене состояния сам элемент не меняется — ни одна другая его пропа не шелохнётся,
   * и мемо вернуло бы прошлый рендер. Подписки здесь для этого мало: она перерисует
   * `CanvasNode`, но не его мемоизированного ребёнка.
   */
  stateId: string | undefined;
  runtime: Record<string, unknown> | undefined;
}

/**
 * Всё изменчивое, что нужно ОДНОМУ узлу холста, одной подпиской на стор.
 *
 * Ключевая правка производительности редактора: раньше эти данные ехали в узлы
 * общим объектом-контекстом из Canvas, поэтому любая правка схемы или смена
 * выделения меняли его identity и перерисовывали все N узлов. Теперь узел
 * подписан на свой срез: при перетаскивании одной фигуры перерисовывается одна
 * фигура, при смене выделения — только два участника.
 *
 * `useShallow` обязателен: селектор собирает новый объект на каждый вызов, и без
 * поверхностного сравнения подписка срабатывала бы на любое изменение стора.
 *
 * Активное состояние компонента и рантайм-оверрайды нужны и для подписки (без неё
 * узел не узнал бы о смене состояния), и как пропы фигуры — см. `stateId`.
 */
export function useElementRenderState(elementKey: string): ElementRenderState {
  return useEditorStore(useShallow((s): ElementRenderState => {
    // Индекс кэширован по ссылке на массив — это O(1) поиск, а не проход по нему.
    const el = getElementIndex(s.elements).byKey[elementKey];
    const isSelected = s.selectedIds.includes(elementKey);
    const cell = s.selectedTableCell;

    return {
      el,
      isSelected,
      isTransformerTarget:
        isSelected &&
        s.selectedIds.length === 1 &&
        !!el &&
        !NON_TRANSFORMABLE.has(el.type),
      isActiveGroup: s.activeGroupKey === elementKey,
      isEditing: s.editingTextKey === elementKey,
      focusedCell: cell && cell.elementKey === elementKey ? cell : null,
      stateId: s.currentComponentStateByElementKey[elementKey],
      runtime: s.runtimeOverridesByElementKey[elementKey],
    };
  }));
}

/**
 * Ключи состава контейнера в порядке отрисовки: composition + children, отсортированные
 * по `zIndex`.
 *
 * Отдельная подписка, а не данные из `EditorRenderContext`: в контексте состава схемы
 * намеренно нет (см. types.ts), иначе ломается мемоизация узлов. `useShallow` сравнивает
 * массив по содержимому — группа перерисовывается только когда порядок реально изменился.
 *
 * composition и children сортируются ОДНИМ пулом: внутри контейнера это соседи, и z-index
 * должен работать между ними. Прежнее правило «примитивы под детьми» остаётся поведением
 * по умолчанию — при равных `zIndex` стабильная сортировка сохраняет порядок конкатенации.
 */
export function useOrderedMemberKeys(group: GroupElement): string[] {
  return useEditorStore(useShallow(s =>
    sortKeysByZIndex(
      [...(group.composition ?? []), ...group.children],
      getElementIndex(s.elements).byKey,
    ),
  ));
}

/**
 * Слушает ли состав контейнера события мыши.
 *
 * Содержимое группы недоступно, пока в группу не вошли двойным кликом: иначе вложенная
 * фигура перехватывает клик и двойной клик у самой группы (кружок открывал правку надписи
 * вместо входа в группу — он гасит всплытие раньше, чем событие дойдёт до `GroupNode`),
 * и её можно утащить из группы, не открыв её.
 *
 * Условие — «активная область в этой группе ИЛИ глубже». Проверка предка обязательна:
 * без неё вход во вложенную группу выключил бы состав внешней, а вместе с ним и саму
 * вложенную — `listening: false` у контейнера Konva гасит всё поддерево.
 *
 * Отдельный хук, а не поле `useElementRenderState`: тот вызывается для КАЖДОГО узла, и
 * обход предков на каждом листе — лишняя работа. Возвращает булево, поэтому подписка
 * перерисовывает только те группы, у которых флаг реально изменился.
 */
export function useMembersInteractive(groupKey: string): boolean {
  return useEditorStore(s => {
    const active = s.activeGroupKey;
    if (!active) return false;
    if (active === groupKey) return true;

    const {byKey} = getElementIndex(s.elements);
    for (let key = byKey[active]?.parentKey; key; key = byKey[key]?.parentKey) {
      if (key === groupKey) return true;
    }
    return false;
  });
}
