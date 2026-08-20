import type { ReactNode } from "react";

export interface ConfirmModalOptions {
  title: string;
  /** Пояснение: что именно произойдёт и можно ли это отменить. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true — деструктивное действие (красная кнопка, иконка предупреждения). */
  danger?: boolean;
}

/** Один вариант в диалоге выбора. `id` возвращается вызывающему. */
export interface ChoiceModalOption {
  id: string;
  label: string;
  /** Что произойдёт при этом выборе — строкой под кнопкой. */
  description?: string;
  /** true — вариант с потерей данных (красная кнопка). */
  danger?: boolean;
}

/**
 * Диалог выбора из нескольких действий — там, где «да/нет» не хватает.
 *
 * Отмена есть всегда и отдельной опцией не описывается: закрытие любым способом
 * (Esc, крестик, клик по оверлею) резолвится в `null`.
 */
export interface ChoiceModalOptions {
  title: string;
  description?: ReactNode;
  options: ChoiceModalOption[];
  cancelLabel?: string;
}

export interface PromptModalOptions {
  title: string;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  /** Пустая строка запрещена по умолчанию. */
  allowEmpty?: boolean;
}
