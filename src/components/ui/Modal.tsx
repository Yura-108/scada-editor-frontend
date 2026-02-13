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
  width = '500px',
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
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-lg"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      <div
        className={`
      relative z-10
      bg-white/10 backdrop-blur-2xl
      border border-white/15
      rounded-3xl
      shadow-2xl shadow-black/30
      w-full max-w-lg
      overflow-hidden
      ring-1 ring-white/10
    `}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 py-5 text-lg font-semibold border-b border-white/10 bg-black/10">
            {title}
          </div>
        )}

        <div className="p-6 md:p-8">{children}</div>

        {footer && (
          <div className="px-6 py-5 border-t border-white/10 flex justify-end gap-4 bg-black/5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
};

export default Modal;