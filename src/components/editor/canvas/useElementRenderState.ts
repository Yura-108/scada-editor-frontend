import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/store/useEditorStore";
import { getElementIndex } from "@/lib/editor/elementIndex";
import { DiagramElement } from "@/types/editorElement.type";

/** Типы со своими специализированными ручками — Transformer к ним не цепляем. */
export const NON_TRANSFORMABLE = new Set(["group", "text", "circle", "line", "polygon"]);

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
 * Активное состояние компонента и рантайм-оверрайды здесь только ради
 * инвалидации: сами значения фигуры читают через `getRenderedElement`, но без
 * подписки узел не узнал бы о смене состояния.
 */
export function useElementRenderState(elementKey: string): ElementRenderState {
  return useEditorStore(useShallow((s): ElementRenderState & {
    stateId: string | undefined;
    runtime: Record<string, unknown> | undefined;
  } => {
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
