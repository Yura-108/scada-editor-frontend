'use client';

import React, { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Локальная модалка с собственным состоянием open/onClose.
 *
 * В отличие от {@link ModalRoot} (единый стек в layout) используется там, где
 * диалог принадлежит конкретному компоненту — «Добавить компонент»,
 * «Переместить в группу».
 *
 * Реализация — Radix Dialog: ручная версия не портировала содержимое в body
 * и не удерживала фокус внутри окна (Tab уводил на элементы под затемнением).
 * Escape, клик вне окна и блокировка прокрутки фона тоже достаются даром.
 */
type ModalProps = {
  open: boolean;
  onClose: () => void;

  /** Обязателен: Radix использует его как имя диалога для скринридера. */
  title: ReactNode;
  /** Подпись под заголовком. Если не задана — скрыта визуально, но есть в DOM. */
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;

  /** false — клик по затемнению не закрывает окно (для форм с несохранёнными данными). */
  closeOnOverlay?: boolean;
};

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnOverlay = true,
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-modal bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />

        <Dialog.Content
          onInteractOutside={(e) => {
            if (!closeOnOverlay) e.preventDefault();
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
            // flex-col + max-h: нижние кнопки не уезжают за край экрана.
            'flex w-[95vw] max-w-lg max-h-[92vh] flex-col overflow-hidden rounded-2xl',
            // Сплошная тема (как у ModalRoot), без «стекла»: одинаково читается
            // в светлой и тёмной.
            'bg-white dark:bg-[#0f0f1a] text-gray-900 dark:text-white',
            'border border-gray-200 dark:border-neutral-800 shadow-2xl shadow-black/30',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'focus:outline-none',
          )}
        >
          <div className="shrink-0 border-b border-gray-200 dark:border-neutral-800 px-6 py-4 pr-14">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            {/* Описание всегда в DOM ради a11y Radix; без текста — скрыто визуально. */}
            <Dialog.Description
              className={cn(
                description
                  ? 'mt-1 text-sm text-gray-600 dark:text-gray-400'
                  : 'sr-only',
              )}
            >
              {description ?? title}
            </Dialog.Description>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-3.5 rounded-full p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </Dialog.Close>

          {/* Прокручиваемая область — нижние кнопки не пропадают за краем экрана. */}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

          {footer && (
            <div className="shrink-0 border-t border-gray-200 dark:border-neutral-800 px-6 py-4 flex justify-end gap-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
