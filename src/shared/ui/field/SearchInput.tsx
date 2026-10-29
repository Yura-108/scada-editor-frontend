"use client";

import React from "react";
import {Search} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Input, type InputProps} from "./Input";

/** Поле поиска: `Input` с лупой слева. `className` — для обёртки (ширина, отступы). */
export function SearchInput({className, ...props}: InputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" {...props} />
    </div>
  );
}
