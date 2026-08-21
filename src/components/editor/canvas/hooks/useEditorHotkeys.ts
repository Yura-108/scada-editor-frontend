import { useEffect } from "react";
import { GRID } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";
import { useModalStore } from "@/store/modalStore";
import { beginHistoryGroup, endHistoryGroup } from "@/lib/editor/historyGroup";

/**
 * Должно ли нажатие быть проигнорировано редактором.
 *
 * Кроме полей ввода проверяем и открытую модалку: Radix рендерит `Dialog.Content`
 * в портал, поэтому события всплывают до `window`. Без этой проверки Delete при
 * фокусе на любом НЕ-поле внутри диалога (кнопка, триггер Select, сам контейнер)
 * удалял выделение на холсте ЗА модалкой; то же касалось Ctrl+A/Ctrl+V/стрелок,
 * а Escape закрывал модалку и одновременно выходил из активной группы.
 */
export function shouldIgnoreEditorHotkey(e: KeyboardEvent): boolean {
  const target = e.target;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  // CodeMirror (редактор скриптов) — contentEditable div, а не textarea.
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  if (target instanceof HTMLElement && target.closest('[role="dialog"], [role="alertdialog"]')) return true;

  // Модалка открыта, но фокус мог остаться на body (например, клик по оверлею).
  if (useModalStore.getState().open) return true;

  return false;
}

const ARROW_STEPS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/**
 * Серия сдвигов стрелками = один шаг истории.
 *
 * Закрывается по keyup, потере фокуса окном или по паузе: браузер шлёт keyup
 * не всегда (переключение окна во время автоповтора), а зависшая пауза истории
 * означала бы, что последующие правки вообще не попадут в undo.
 */
const ARROW_SERIES_IDLE_MS = 600;
let arrowSeriesTimer: ReturnType<typeof setTimeout> | null = null;

function beginArrowSeries() {
  if (arrowSeriesTimer) clearTimeout(arrowSeriesTimer);
  else beginHistoryGroup();
  arrowSeriesTimer = setTimeout(endArrowSeries, ARROW_SERIES_IDLE_MS);
}

function endArrowSeries() {
  if (!arrowSeriesTimer) return;
  clearTimeout(arrowSeriesTimer);
  arrowSeriesTimer = null;
  endHistoryGroup();
}

interface EditorHotkeysDeps {
  /** false — хоткеи не вешаются вовсе (режим монитора). По умолчанию true. */
  enabled?: boolean;
  activeGroupKey: string | null;
  exitGroup: () => void;
  clearSelection: () => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
  duplicateSelected: () => void;
  selectAllInScope: () => void;
  moveSelectedBy: (dx: number, dy: number) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
}

/**
 * ЕДИНСТВЕННЫЙ реестр горячих клавиш редактора: Escape / Delete / Ctrl+C / Ctrl+V /
 * Ctrl+D (дубликат) / Ctrl+A (выделить всё в скоупе) / Ctrl+Z / Ctrl+Y (undo/redo) /
 * Ctrl+G (группировка) / стрелки (сдвиг на шаг сетки, с Shift — на 1px).
 *
 * Раньше Ctrl+Z/Y/G жили отдельно в EditorClient со своим, более слабым набором
 * guard-условий (без contentEditable), из-за чего Ctrl+Z внутри редактора скриптов
 * отменял правку СХЕМЫ, а Ctrl+G группировал элементы. Два реестра с разными
 * правилами — сама по себе причина таких расхождений, поэтому теперь он один.
 */
export function useEditorHotkeys({
  enabled = true,
  activeGroupKey,
  exitGroup,
  clearSelection,
  deleteSelectedElement,
  copySelectedElement,
  pasteSelectedElement,
  duplicateSelected,
  selectAllInScope,
  moveSelectedBy,
  groupSelected,
  ungroupSelected,
}: EditorHotkeysDeps) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreEditorHotkey(e)) return;

      if (e.key === "Escape") {
        e.preventDefault();
        // Сначала снимаем «вооружённый» инструмент палитры, не трогая выделение/группу.
        const { pendingPlacement, setPendingPlacement } = useEditorStore.getState();
        if (pendingPlacement) { setPendingPlacement(null); return; }
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
      // Undo/Redo: Ctrl+Z, Ctrl+Shift+Z и Ctrl+Y.
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        const {undo, redo} = useEditorStore.temporal.getState();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        useEditorStore.temporal.getState().redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyG") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
      }

      // Поворот на 90° и отражения. Читаем `e.code`, а не `e.key`: на русской
      // раскладке те же клавиши дают «Ю», «Б», «Р», «М», и по символу они бы не ловились.
      // Ctrl исключён намеренно — Ctrl+Shift+V у браузера своя роль.
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const TRANSFORMS: Record<string, "cw" | "ccw" | "flipH" | "flipV"> = {
          Period: "cw",   // Shift + > — по часовой
          Comma: "ccw",   // Shift + < — против часовой
          KeyH: "flipH",
          KeyV: "flipV",
        };
        const op = TRANSFORMS[e.code];
        if (op) {
          e.preventDefault();
          useEditorStore.getState().transformSelected(op);
        }
      }

      // Стрелки: сдвиг выделения на шаг сетки; Shift — точная подстройка на 1px.
      if (ARROW_STEPS[e.key]) {
        e.preventDefault();
        // Автоповтор клавиши даёт ~30 сдвигов в секунду, и каждый был отдельным
        // шагом undo: стек на 50 записей забивался за пару секунд, а вернуть
        // элемент на место одним Ctrl+Z было невозможно. Всю серию (до паузы
        // или отпускания клавиши) считаем одним действием.
        beginArrowSeries();
        const step = e.shiftKey ? 1 : GRID;
        const [dx, dy] = ARROW_STEPS[e.key];
        moveSelectedBy(dx * step, dy * step);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (ARROW_STEPS[e.key]) endArrowSeries();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    // Потеря фокуса окном во время удержания клавиши: keyup не придёт.
    window.addEventListener("blur", endArrowSeries);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", endArrowSeries);
      endArrowSeries();
    };
  }, [
    enabled,
    deleteSelectedElement, copySelectedElement, pasteSelectedElement,
    duplicateSelected, selectAllInScope, moveSelectedBy,
    activeGroupKey, exitGroup, clearSelection,
    groupSelected, ungroupSelected,
  ]);
}
