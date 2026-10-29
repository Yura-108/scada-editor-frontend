'use client';

import React, { ReactNode } from 'react';
import { DialogFrame } from './DialogFrame';
import { DialogBody, DialogFooter, DialogHeader } from './DialogParts';

/**
 * Локальная модалка с собственным состоянием open/onClose.
 *
 * В отличие от {@link ModalRoot} (стек окон в layout) используется там, где
 * диалог принадлежит конкретному компоненту — «Добавить компонент»,
 * «Переместить в группу». Рамка, шапка и подвал — общие (`DialogFrame`, `DialogParts`).
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
  if (!open) return null;

  return (
    <DialogFrame size="md" onClose={onClose} closeOnOverlay={closeOnOverlay}>
      <DialogHeader title={title} description={description} />
      {/* Отступы тела пока задают сами окна — оба пользователя рисуют их в `children`. */}
      <DialogBody className="p-0">{children}</DialogBody>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </DialogFrame>
  );
};

export default Modal;
