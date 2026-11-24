"use client";

import React, {type ReactNode} from "react";
import {cn} from "@/shared/lib/cn";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Подпись справа; клик по ней тоже переключает. */
  label?: ReactNode;
  ref?: React.Ref<HTMLInputElement>;
};

/**
 * Флажок приложения — обычный чекбокс браузера в цвете акцента: клавиатура, формы и
 * скринридеры работают сами, без своей реализации.
 */
export function Checkbox({label, className, ...props}: CheckboxProps) {
  const box = (
    <input
      type="checkbox"
      className={cn("h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed", !label && className)}
      {...props}
    />
  );
  if (!label) return box;
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2 text-sm text-foreground",
        "has-disabled:cursor-not-allowed has-disabled:opacity-50",
        className,
      )}
    >
      {box}
      {label}
    </label>
  );
}
