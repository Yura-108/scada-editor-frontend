import React from "react";
import {cn} from "@/shared/lib/cn";
import {toneStyles, type Tone} from "./tone";

/**
 * Значок статуса: «Работает», «OK», «изменена», «prod». Только надпись — нажимать его
 * нельзя; кнопка со статусом — это `Button`.
 */
export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  /** Значок перед текстом, размер 12. */
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        toneStyles[tone].strong,
        toneStyles[tone].text,
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
