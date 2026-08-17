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
