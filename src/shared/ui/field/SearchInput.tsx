"use client";

import React from "react";
import {Search} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Input, type InputProps} from "./Input";

/**
 * Поле поиска: `Input` с лупой слева. `className` — для обёртки (ширина, отступы),
 * `inputClassName` — для самого поля (например, место справа под кнопку «очистить»).
 */
export function SearchInput({className, inputClassName, ...props}: InputProps & {inputClassName?: string}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn("pl-9", inputClassName)} {...props} />
    </div>
  );
}
