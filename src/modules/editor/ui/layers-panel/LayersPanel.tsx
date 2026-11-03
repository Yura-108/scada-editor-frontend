"use client";

import React from "react";
import {ChevronsDownUp, ChevronsUpDown} from "lucide-react";
import {useEditorStore} from "../../model/editorStore";
import {IconButton} from "@/shared/ui/IconButton";
import {LayerRow} from "./LayerRow";
import {useLayerKeyboard} from "./useLayerKeyboard";
import {useLayerTree} from "./useLayerTree";

/**
 * Панель слоёв: дерево объектов сцены (группы/компоненты + члены children и composition).
 * Клик — выделение (Ctrl — добавить), двойной клик по группе — войти в неё.
 */
export function LayersPanel() {
  const selectedIds = useEditorStore(s => s.selectedIds);
  const selectMultiple = useEditorStore(s => s.selectMultiple);
  const enterGroup = useEditorStore(s => s.enterGroup);
  const revealElement = useEditorStore(s => s.revealElement);
  const ensureElementVisible = useEditorStore(s => s.ensureElementVisible);

  const {collapsed, toggleCollapsed, containerKeys, allCollapsed, toggleAll, visibleRows} = useLayerTree();

  const handleSelect = (key: string, additive: boolean) => {
    if (additive) {
      selectMultiple([...selectedIds.filter(id => id !== key), key]);
    } else {
      // Одиночный выбор ОТКРЫВАЕТ уровень элемента: содержимое неоткрытой группы на холсте
      // недоступно, и элемент оказался бы выделенным, но неподвижным. Одним действием, а не
      // «войти, затем выделить»: enterGroup чистит выделение.
      revealElement(key);
    }
    // Камеру двигаем ТОЛЬКО отсюда, а не из revealElement: при выделении на холсте или
    // Ctrl+A ехать некуда — человек и так смотрит на элемент.
    ensureElementVisible(key);
  };

  const {treeRef, currentKey, setActiveKey, handleKeyDown} = useLayerKeyboard({
    visibleRows, selectedIds, toggleCollapsed, handleSelect, enterGroup,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-2">
        <h3
          id="layers-panel-heading"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Слои
        </h3>
        {containerKeys.length > 0 && (
          <IconButton
            icon={allCollapsed ? ChevronsUpDown : ChevronsDownUp}
            label={allCollapsed ? "Развернуть всё" : "Свернуть всё"}
            size="xs"
            onClick={toggleAll}
          />
        )}
      </div>
      <div
        ref={treeRef}
        role="tree"
        aria-labelledby="layers-panel-heading"
        aria-multiselectable
        className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-0.5"
      >
        {visibleRows.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">Схема пуста</div>
        ) : (
          visibleRows.map(({el, depth, isComposition}) => (
            <LayerRow
              key={el.key}
              el={el}
              depth={depth}
              isComposition={isComposition}
              collapsed={collapsed}
              selectedIds={selectedIds}
              currentKey={currentKey}
              onClick={(e) => {
                setActiveKey(el.key);
                handleSelect(el.key, e.ctrlKey || e.metaKey || e.shiftKey);
              }}
              onDoubleClick={() => { if (el.type === "group") enterGroup(el.key); }}
              onKeyDown={handleKeyDown}
              toggleCollapsed={toggleCollapsed}
            />
          ))
        )}
      </div>
    </div>
  );
}
