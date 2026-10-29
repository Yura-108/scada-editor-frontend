"use client";

import {Fragment} from "react";
import {DialogFrame} from "./DialogFrame";
import {useModalStore} from "./modalStore";
import {ModalEntryContext} from "./useCloseModal";

/**
 * Стек окон приложения (содержимое кладут `openModal` / `pushModal` из `modalStore`).
 *
 * Контракт содержимого: оно ОБЯЗАНО отрендерить `Dialog.Title` и
 * `Dialog.Description` — Radix берёт из них `aria-labelledby`/`aria-describedby`,
 * без них диалог остаётся для скринридера безымянным, а в консоль летит
 * предупреждение. Заголовок здесь не рендерится намеренно: он был бы вторым
 * `Dialog.Title` с тем же id, что ломает разметку.
 * Содержимое собирается из `DialogHeader`/`DialogBody`/`DialogFooter` (`DialogParts.tsx`);
 * у редакторов кода описание прячется под «?» — `DialogHeader hint`.
 */
export function ModalRoot() {
  const stack = useModalStore((s) => s.stack);
  const closeModalById = useModalStore((s) => s.closeModalById);

  return stack.map((entry, depth) => (
    <ModalEntryContext.Provider key={entry.id} value={entry.id}>
      <DialogFrame
        onClose={() => closeModalById(entry.id)}
        size={entry.size}
        depth={depth}
        closeOnOverlay={entry.closeOnOverlay}
      >
        {/* Подменили содержимое (openModal поверх своего же места) — оно монтируется заново. */}
        <Fragment key={entry.contentKey}>{entry.content}</Fragment>
      </DialogFrame>
    </ModalEntryContext.Provider>
  ));
}
