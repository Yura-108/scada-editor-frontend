'use client';
import React, {ReactNode, useEffect} from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;

  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;

  width?: string;
  closeOnOverlay?: boolean;
};

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnOverlay = true
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent)=> {
      if (e.key === 'Escape') onClose();
    };

    if (open) {
      window.addEventListener('keydown', handleEsc);
    }

    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Сплошная тема (как у ModalRoot), без «стекла»: одинаково читается в светлой и тёмной. */}
      <div
        className="
          relative z-10 flex flex-col
          w-full max-w-lg max-h-[92vh] overflow-hidden
          rounded-2xl
          bg-white dark:bg-[#0f0f1a]
          text-gray-900 dark:text-white
          border border-gray-200 dark:border-neutral-800
          shadow-2xl shadow-black/30
        "
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 py-4 text-lg font-semibold border-b border-gray-200 dark:border-neutral-800 shrink-0">
            {title}
          </div>
        )}

        {/* Прокручиваемая область — нижние кнопки не пропадают за краем экрана. */}
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
};

export default Modal;