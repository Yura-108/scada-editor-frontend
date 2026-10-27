import { useState } from "react";
import type Konva from "konva";
import { buildItemMenu } from "../lib/buildItemMenu";
import type { DiagramElement } from "@/types/editorElement.type";
import { useEditorStore } from "../../../model/editorStore";
import type { SetCanvasMenu } from "../types";

interface UseEditorContextMenuArgs {
  elements: DiagramElement[];
  elementsMap: Record<string, DiagramElement>;
  resolveClickTarget: (key: string) => string | null;
  closeMenu: () => void;
  setContextMenu: SetCanvasMenu;
}

export interface MoveToGroupState { isOpen: boolean; elementKey: string | null }
export interface AddComponentState { isOpen: boolean; targetKey: string | null }

/** Редактор: меню по ПКМ — «Вставить» на пустом месте, меню элемента и его модалки. */
export function useEditorContextMenu({
  elements, elementsMap, resolveClickTarget, closeMenu, setContextMenu,
}: UseEditorContextMenuArgs) {
  const selectMultiple = useEditorStore(s => s.selectMultiple);
  const copySelectedElement = useEditorStore(s => s.copySelectedElement);
  const deleteSelectedElement = useEditorStore(s => s.deleteSelectedElement);
  const pasteSelectedElement = useEditorStore(s => s.pasteSelectedElement);

  const [moveToGroupState, setMoveToGroupState] = useState<MoveToGroupState>({ isOpen: false, elementKey: null });
  const [addComponentState, setAddComponentState] = useState<AddComponentState>({ isOpen: false, targetKey: null });

  /** ПКМ по холсту редактора; `preventDefault` уже сделан вызывающим. */
  const handleEditorContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const tg = e.target;

    if (tg === e.target.getStage() || tg.name() === "grid-bg") {
      setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [{ label: "Вставить", onClick: () => { pasteSelectedElement(); closeMenu(); } }],
      });
      return;
    }

    const hitId = tg.attrs.id || tg.parent?.attrs.id || tg.parent?.parent?.attrs.id;
    if (!hitId) return;

    // Через resolveClickTarget, как левый клик: иначе правым кликом можно было выделить
    // вложенный элемент, чего левый не позволяет, и меню применялось бы к тому, что на
    // холсте недоступно.
    const elId = resolveClickTarget(hitId);
    if (!elId) return;

    // Выделение сбрасываем только если кликнули ВНЕ него: иначе правый клик по одному
    // из нескольких выделенных схлопывал набор, и пункты меню («Повернуть», «Копировать»,
    // «Удалить») применялись к одному элементу вместо всех. Правило то же, что у левого
    // нажатия (см. selectOnPress).
    if (!useEditorStore.getState().selectedIds.includes(elId)) selectMultiple([elId]);
    const el = elementsMap[elId];
    if (!el) return;

    setContextMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      items: buildItemMenu(el, {
        elements,
        closeMenu,
        copySelectedElement,
        deleteSelectedElement,
        openMoveToGroup: (key) => setMoveToGroupState({ isOpen: true, elementKey: key }),
        openAddComponent: (key) => setAddComponentState({ isOpen: true, targetKey: key }),
      }),
    });
  };

  return {
    handleEditorContextMenu,
    moveToGroupState,
    closeMoveToGroup: () => setMoveToGroupState({ isOpen: false, elementKey: null }),
    addComponentState,
    closeAddComponent: () => setAddComponentState({ isOpen: false, targetKey: null }),
  };
}
