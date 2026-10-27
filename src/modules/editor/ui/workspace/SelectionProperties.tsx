"use client";

import {useMemo} from "react";
import {MultiPropertiesPanel} from "../properties-panel/MultiPropertiesPanel";
import {ScenePropertiesPanel} from "../properties-panel/ScenePropertiesPanel";
import {useEditorStore} from "../../model/editorStore";
import {PropertiesPanel} from "../properties-panel";

/**
 * Содержимое правой панели по выделению: один элемент, несколько, ничего (свойства сцены).
 *
 * Подписка на `elements` и выделение живёт здесь, а не в WorkSpace: иначе каждая правка
 * элемента перерисовывала бы весь редактор вместе с палитрой и тулбаром.
 */
export function SelectionProperties() {
  // Точечные селекторы вместо подписки на весь стор: иначе каждый тик пана/зума
  // ре-рендерил панель вместе с соседями.
  const selectedIds = useEditorStore(s => s.selectedIds);
  const selectedElement = useEditorStore(s => s.elements.find(el => el.key === s.selectedIds[0]));
  const elements = useEditorStore(s => s.elements);
  const isVersionPreview = useEditorStore(s => s.versionPreview !== null);

  const selectedElements = useMemo(
    () => selectedIds.map(id => elements.find(el => el.key === id)).filter((el): el is NonNullable<typeof el> => Boolean(el)),
    [selectedIds, elements],
  );

  if (isVersionPreview) {
    /* Холст в режиме просмотра readOnly, но выделить элемент можно из «Слоёв»,
       а панель свойств пишет в стор напрямую. Правки ушли бы в СТАРУЮ версию и
       молча пропали при выходе (стеш восстанавливает исходное состояние). */
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">
          Просмотр версии — свойства доступны только для чтения.
          <br />
          Выйдите из просмотра, чтобы редактировать схему.
        </div>
      </div>
    );
  }

  if (selectedElement && selectedIds.length === 1) return <PropertiesPanel element={selectedElement} />;
  if (selectedElements.length > 1) return <MultiPropertiesPanel elements={selectedElements} />;

  // Ничего не выделено — показываем свойства самой сцены (размер листа).
  // Подсказка «выберите элемент» переехала в низ этой же панели.
  return <ScenePropertiesPanel />;
}
