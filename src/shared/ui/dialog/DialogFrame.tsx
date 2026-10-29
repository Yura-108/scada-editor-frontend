"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * Ширина окна. Окно не придумывает свою ширину — берёт одну из этих:
 * - `sm` — подтверждения, ввод имени;
 * - `md` — короткие формы;
 * - `lg` — широкие подтверждения, журнал;
 * - `xl` — списки и таблицы;
 * - `fullscreen` — редакторы кода, тренды, рецепты.
 */
export type DialogSize = "sm" | "md" | "lg" | "xl" | "fullscreen";

const SIZES: Record<DialogSize, string> = {
  sm: "w-[95vw] max-w-md max-h-[92vh]",
  md: "w-[95vw] max-w-lg max-h-[92vh]",
  lg: "w-[95vw] max-w-2xl max-h-[92vh]",
  xl: "w-[95vw] max-w-4xl max-h-[92vh]",
  fullscreen: "w-[98vw] h-[96vh] max-w-none",
};

/**
 * Слой окна: `modal` — обычные окна, `confirm` — подтверждения, всегда поверх окон.
 * Внутри слоя каждое следующее окно стека — на ступень выше (`depth`).
 */
export type DialogLayer = "modal" | "confirm";

type DialogFrameProps = {
  onClose: () => void;
  size?: DialogSize;
  layer?: DialogLayer;
  depth?: number;
  /** false — клик по затемнению не закрывает окно (формы с несохранёнными данными). */
  closeOnOverlay?: boolean;
  /** Крестик в углу. У подтверждений его нет: все исходы — кнопки внизу. */
  showClose?: boolean;
  children: ReactNode;
};

/**
 * Рамка окна: затемнение, само окно и крестик. Шапку, тело и подвал рисует содержимое —
 * `DialogHeader`, `DialogBody`, `DialogFooter` (`DialogParts.tsx`).
 *
 * Окно — колонка с ограниченной высотой: прокручивается тело между шапкой и подвалом,
 * кнопки внизу всегда на экране.
 */
export function DialogFrame({
  onClose,
  size = "xl",
  layer = "modal",
  depth = 0,
  closeOnOverlay = true,
  showClose = true,
  children,
}: DialogFrameProps) {
  const style: CSSProperties = { zIndex: `calc(var(--z-${layer}) + ${depth})` };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={style}
          className={cn(
            "fixed inset-0 bg-overlay backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          style={style}
          onInteractOutside={(e) => { if (!closeOnOverlay) e.preventDefault(); }}
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl",
            SIZES[size],
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "focus:outline-none",
          )}
        >
          {showClose && (
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Закрыть"
                className="absolute right-4 top-4 z-10 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
