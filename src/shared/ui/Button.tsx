"use client";

import React from "react";
import { cn } from "@/shared/lib/cn";

/**
 * Кнопка приложения.
 *
 * Пара «Отмена / Создать» была скопирована в шесть с лишним модалок, и копии
 * разъехались: где-то `disabled:from-gray-300`, где-то `disabled:from-gray-700`,
 * в окне ввода строки у «Отмены» стоял `hover:bg-gray-700` без `dark:` (в светлой
 * теме кнопка темнела при наведении), а у главной кнопки — `text-gray-900
 * dark:text-white` поверх индигового градиента, то есть почти чёрный текст на
 * тёмно-синем. Здесь один источник правды.
 */
type Variant = "primary" | "secondary" | "danger";
/** `md` — кнопки окон и форм, `sm` — компактные кнопки в панелях и строках таблиц. */
type Size = "md" | "sm";

// Рамка есть у всех вариантов (у сплошных — прозрачная): иначе «Отмена» с рамкой
// на 2px выше соседней «Создать». Наведение — только у активной кнопки (`enabled:`).
const base = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg border font-medium",
  "transition-colors disabled:cursor-not-allowed",
);

// Неактивная главная кнопка — серая, а не бледный акцент: «нельзя нажать» должно
// читаться сразу.
const disabledSolid = "disabled:border-input disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none";

const variants: Record<Variant, string> = {
  primary: cn(
    "border-transparent bg-primary text-primary-foreground shadow-sm enabled:hover:bg-primary/90",
    disabledSolid,
  ),
  secondary: "border-input bg-transparent text-foreground enabled:hover:bg-accent disabled:opacity-60",
  danger: cn(
    "border-transparent bg-destructive text-destructive-foreground shadow-sm enabled:hover:bg-destructive/90",
    disabledSolid,
  ),
};

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5",
  sm: "px-3 py-1.5 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

/** Ряд кнопок внизу модалки. */
export function ModalFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mt-8 flex gap-3 justify-end", className)}>{children}</div>;
}
