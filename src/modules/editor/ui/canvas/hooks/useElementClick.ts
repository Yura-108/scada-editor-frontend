import { useCallback } from "react";
import { resolveClickTarget as resolveClickTargetFn } from "@/lib/editor/resolveClickTarget";
import { getElementIndex } from "@/lib/editor/elementIndex";
import { useEditorStore } from "../../../model/editorStore";

/**
 * Клик по элементу в редакторе: кого он выделяет и как переключает выделение.
 *
 * Колбэки намеренно БЕЗ зависимостей от изменчивого состояния: они попадают в ctx
 * холста, а ctx обязан быть стабильным по ссылке (иначе не работает мемоизация узлов).
 * Актуальные elements/selectedIds/activeGroupKey читаем через getState() в момент
 * вызова — это обработчики событий, не рендер.
 */
export function useElementClick() {
  const resolveClickTarget = useCallback((key: string) => {
    const s = useEditorStore.getState();
    return resolveClickTargetFn(
      key,
      getElementIndex(s.elements).byKey,
      s.activeGroupKey,
      String(s.scene?.id),
    );
  }, []);

  const handleElementClick = useCallback((clickedKey: string, multi: boolean) => {
    const s = useEditorStore.getState();
    // Вооружён инструмент палитры — клик по фигуре ставит новый элемент (на Stage.onClick),
    // а не выделяет существующий.
    if (s.pendingPlacement) return;
    const target = resolveClickTarget(clickedKey);
    if (target === null) { s.exitGroup(); return; }

    if (!multi) {
      s.selectMultiple([target]);
      return;
    }

    // Ctrl/Shift+клик ПЕРЕКЛЮЧАЕТ элемент. Раньше он всегда добавлялся в конец
    // (filter + append), поэтому снять выделение модификатором было невозможно.
    const current = s.selectedIds;
    s.selectMultiple(
      current.includes(target)
        ? current.filter(id => id !== target)
        : [...current, target],
    );
  }, [resolveClickTarget]);

  // Клик по ячейке таблицы: сначала выделяем таблицу целиком (как обычный клик по элементу),
  // затем фокусируем ячейку — handleElementClick/selectMultiple сбрасывают selectedTableCell,
  // поэтому selectTableCell обязан выполниться ПОСЛЕ него в этом же синхронном обработчике.
  const onTableCellClick = useCallback((elementKey: string, row: number, col: number, multi: boolean) => {
    handleElementClick(elementKey, multi);
    useEditorStore.getState().selectTableCell(elementKey, row, col);
  }, [handleElementClick]);

  return { resolveClickTarget, handleElementClick, onTableCellClick };
}
