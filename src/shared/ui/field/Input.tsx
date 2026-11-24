"use client";

import React from "react";
import {cn} from "@/shared/lib/cn";
import {useFieldContext} from "./Field";
import {fieldBase, fieldSizes, type FieldSize} from "./fieldStyles";

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: FieldSize;
  ref?: React.Ref<HTMLInputElement>;
};

/** Однострочное поле приложения. Внутри `Field` само связывается с подписью. */
export function Input({size = "md", className, id, ...props}: InputProps) {
  const field = useFieldContext();
  return (
    <input
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(fieldBase, fieldSizes[size], className)}
      {...props}
    />
  );
}
