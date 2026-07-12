import { useEffect } from "react";
import { GRID } from "@/lib/utils";

interface EditorHotkeysDeps {
  activeGroupKey: string | null;
  exitGroup: () => void;
  clearSelection: () => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
  duplicateSelected: () => void;
  selectAllInScope: () => void;
  moveSelectedBy: (dx: number, dy: number) => void;
}

/**
 * Глобальные горячие клавиши редактора: Escape / Delete / Ctrl+C / Ctrl+V /
 * Ctrl+D (дубликат) / Ctrl+A (выделить всё в скоупе) / стрелки (сдвиг на шаг
 * сетки, с Shift — на 1px). Undo/Redo (Ctrl+Z/Y) живут в EditorClient.
 */
export function useEditorHotkeys({
  activeGroupKey,
  exitGroup,
  clearSelection,
  deleteSelectedElement,
  copySelectedElement,
  pasteSelectedElement,
  duplicateSelected,
  selectAllInScope,
  moveSelectedBy,
}: EditorHotkeysDeps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (activeGroupKey) exitGroup();
        else clearSelection();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedElement();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyC") {
        e.preventDefault();
        copySelectedElement();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyV") {
        e.preventDefault();
        pasteSelectedElement();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyD") {
        e.preventDefault(); // иначе браузер откроет «добавить закладку»
        duplicateSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyA") {
        e.preventDefault();
        selectAllInScope();
      }

      // Стрелки: сдвиг выделения на шаг сетки; Shift — точная подстройка на 1px.
      const arrow: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      if (arrow[e.key]) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : GRID;
        const [dx, dy] = arrow[e.key];
        moveSelectedBy(dx * step, dy * step);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    deleteSelectedElement, copySelectedElement, pasteSelectedElement,
    duplicateSelected, selectAllInScope, moveSelectedBy,
    activeGroupKey, exitGroup, clearSelection,
  ]);
}
