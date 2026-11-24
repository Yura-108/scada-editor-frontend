"use client";

import React from "react";
import {cn} from "@/shared/lib/cn";
import {useFieldContext} from "./Field";
import {fieldBase} from "./fieldStyles";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
};

/** Многострочное поле: та же рамка и фокус, что у `Input`, высота тянется вниз. */
export function Textarea({className, id, ...props}: TextareaProps) {
  const field = useFieldContext();
  return (
    <textarea
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(fieldBase, "min-h-20 resize-y px-3 py-2 text-sm", className)}
      {...props}
    />
  );
}
