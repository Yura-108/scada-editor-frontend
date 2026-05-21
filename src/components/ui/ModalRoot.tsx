// components/ModalRoot.tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";

export function ModalRoot() {
  const { open, content, closeModal } = useModalStore();

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeModal()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />

        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[95vw] max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-[#0f0f1a] text-white",
            "border border-gray-800/70 shadow-2xl shadow-black/50",
            "p-6 sm:p-8",
            // анимация (можно оставить framer-motion, но Radix тоже хорошо анимирует)
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2",
            "focus:outline-none"
          )}
        >
          {/* Кнопка закрытия */}
          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-800/60 hover:text-white transition-colors"
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>
          </Dialog.Close>

          {content}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}