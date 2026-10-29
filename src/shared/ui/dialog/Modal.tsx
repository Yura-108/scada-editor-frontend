'use client';

import React, { ReactNode } from 'react';
import { DialogFrame, type DialogSize } from './DialogFrame';
import { DialogBody, DialogFooter, DialogHeader } from './DialogParts';

/**
 * Локальная модалка с собственным состоянием open/onClose.
 *
 * В отличие от {@link ModalRoot} (стек окон в layout) используется там, где
 * диалог принадлежит конкретному компоненту — «Добавить компонент»,
 * «Переместить в группу», выбор свойства и тега для привязки. Рамка, шапка и подвал —
 * общие (`DialogFrame`, `DialogParts`). Открытая изнутри окна стека, встаёт поверх него.
 */
type ModalProps = {
  open: boolean;
  onClose: () => void;

  /** Обязателен: Radix использует его как имя диалога для скринридера. */
  title: ReactNode;
  /** Подпись под заголовком. Если не задана — скрыта визуально, но есть в DOM. */
  description?: ReactNode;
  /** Значок слева от заголовка (`DialogHeader`). */
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /**
   * Классы тела. `flex flex-col` — когда прокручивается не всё тело, а часть: дерево
   * под закреплённым поиском.
   */
  bodyClassName?: string;

  /** Ширина окна (`DialogFrame`). По умолчанию `md`. */
  size?: DialogSize;
  /** false — клик по затемнению не закрывает окно (для форм с несохранёнными данными). */
  closeOnOverlay?: boolean;
};

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  bodyClassName,
  size = 'md',
  closeOnOverlay = true,
}) => {
  if (!open) return null;

  return (
    <DialogFrame size={size} onClose={onClose} closeOnOverlay={closeOnOverlay}>
      <DialogHeader icon={icon} title={title} description={description} />
      <DialogBody className={bodyClassName}>{children}</DialogBody>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </DialogFrame>
  );
};

export default Modal;
