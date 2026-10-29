"use client";

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
 * Готовые заготовки: `DialogHeader` (`DialogParts.tsx`), `TitleWithHint`
 * (`ui/codeModalParts.tsx`) для окон с редактором кода, либо собственный `Dialog.Title`.
 *
 * Содержимое пока рисуется в прежней прокручиваемой области с отступами: окна ещё
 * собраны без `DialogHeader`/`DialogBody`/`DialogFooter`.
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
        {entry.size === "fullscreen" ? (
          // Полноэкранный режим: контент сам управляет своей раскладкой (flex h-full),
          // чтобы редактор кода растянулся на всю доступную высоту.
          <div key={entry.contentKey} className="flex min-h-0 flex-1 flex-col p-6 sm:p-8">
            {entry.content}
          </div>
        ) : (
          // Прокручиваемая область: padding здесь, чтобы скролл-бар был у края.
          <div key={entry.contentKey} className="overflow-y-auto p-6 sm:p-8">
            {entry.content}
          </div>
        )}
      </DialogFrame>
    </ModalEntryContext.Provider>
  ));
}
