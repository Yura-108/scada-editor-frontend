"use client";

import { MoveToGroupModal } from "./MoveToGroupModal";
import { AddComponentModal } from "./AddComponentModal";
import type { AddComponentState, MoveToGroupState } from "./hooks/useEditorContextMenu";

interface CanvasModalsProps {
  moveToGroupState: MoveToGroupState;
  closeMoveToGroup: () => void;
  addComponentState: AddComponentState;
  closeAddComponent: () => void;
}

/**
 * Модалки меню элемента. Монтируем только на время показа: обе модалки читают
 * `elements`, и постоянно смонтированные они подписывали холст на лишние обновления.
 */
export function CanvasModals({ moveToGroupState, closeMoveToGroup, addComponentState, closeAddComponent }: CanvasModalsProps) {
  return (
    <>
      {moveToGroupState.isOpen && (
        <MoveToGroupModal
          isOpen
          elementKey={moveToGroupState.elementKey}
          onClose={closeMoveToGroup}
        />
      )}

      {addComponentState.isOpen && (
        <AddComponentModal
          isOpen
          targetKey={addComponentState.targetKey}
          onClose={closeAddComponent}
        />
      )}
    </>
  );
}
