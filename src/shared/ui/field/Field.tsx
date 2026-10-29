"use client";

import React, {createContext, useContext, useId, type ReactNode} from "react";
import {cn} from "@/shared/lib/cn";
import {fieldLabelClass, fieldLabelSmClass, type FieldSize} from "./fieldStyles";

interface FieldContextValue {
  /** id поля — на него ссылается подпись. */
  id: string;
  /** id подписи — для полей-кнопок (Radix Select), которые подписывают через aria-labelledby. */
  labelId: string;
  /** id подсказки или ошибки, если они есть. */
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Связь с обёрткой `Field`: поле берёт отсюда id, описание и признак ошибки. */
export const useFieldContext = () => useContext(FieldContext);

/**
 * Подпись, поле и под ним подсказка или ошибка. Поле внутри (`Input`, `Textarea`, `Select`)
 * само получает id подписи и описания — `htmlFor` и `aria-describedby` руками не пишутся.
 */
export function Field({label, hint, error, size = "md", className, children}: {
  label: ReactNode;
  /** `sm` — компактная подпись (`text-xs`) для полей `sm` в панелях. */
  size?: FieldSize;
  hint?: ReactNode;
  /** Текст ошибки: показывается вместо подсказки, поле помечается `aria-invalid`. */
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const noteId = `${id}-note`;
  const note = error || hint;

  return (
    <FieldContext.Provider value={{id, labelId, describedBy: note ? noteId : undefined, invalid: Boolean(error)}}>
      <div className={cn("space-y-1.5", className)}>
        <label id={labelId} htmlFor={id} className={size === "sm" ? fieldLabelSmClass : fieldLabelClass}>
          {label}
        </label>
        {children}
        {note && (
          <p id={noteId} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
            {note}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
