"use client";

import {useEffect} from "react";
import WorkSpace from "@/components/editor/WorkSpace";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useAutoSaveScene, useWarnOnUnsavedChanges} from "@/lib/useAutoSaveScene";

export default function EditorPage() {
  // Точечный селектор: подписка на весь стор палитры перерисовывала страницу
  // редактора при любой её загрузке/правке.
  const loadPaletteItems = usePaletteStore(s => s.loadPaletteItems);

  // Автосохранение раз в 10 минут (только при изменениях, тихо, без сброса выделения)
  // + предупреждение при закрытии вкладки с несохранённой схемой.
  useAutoSaveScene();
  useWarnOnUnsavedChanges();

  // Ctrl+Z / Ctrl+Y / Ctrl+G раньше жили здесь отдельным реестром без проверки
  // contentEditable, поэтому срабатывали внутри редактора скриптов (CodeMirror).
  // Теперь все хоткеи редактора — в useEditorHotkeys (см. Canvas).

  useEffect(() => {
    // Палитра подгружается автоматически при монтировании, если ещё не загружена.
    loadPaletteItems();
  }, [loadPaletteItems]);

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 overflow-hidden">
      {/* Элементы добавляются кликом: клик по элементу палитры «вооружает» инструмент,
          клик по холсту ставит элемент (см. Canvas.handleStagePlacementClick). */}
      <WorkSpace />
    </div>
  );
}
