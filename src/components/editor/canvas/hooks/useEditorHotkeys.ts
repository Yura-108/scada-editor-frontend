import { useEffect } from "react";

interface EditorHotkeysDeps {
  activeGroupKey: string | null;
  exitGroup: () => void;
  clearSelection: () => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
}

/** Глобальные горячие клавиши редактора: Escape / Delete / Ctrl+C / Ctrl+V. */
export function useEditorHotkeys({
  activeGroupKey,
  exitGroup,
  clearSelection,
  deleteSelectedElement,
  copySelectedElement,
  pasteSelectedElement,
}: EditorHotkeysDeps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelectedElement, copySelectedElement, pasteSelectedElement, activeGroupKey, exitGroup, clearSelection]);
}
