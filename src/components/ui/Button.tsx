"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Кнопка приложения.
 *
 * Пара «Отмена / Создать» была скопирована в шесть с лишним модалок, и копии
 * разъехались: где-то `disabled:from-gray-300`, где-то `disabled:from-gray-700`,
 * в `OpenInputModal` у «Отмены» стоял `hover:bg-gray-700` без `dark:` (в светлой
 * теме кнопка темнела при наведении), а у главной кнопки — `text-gray-900
 * dark:text-white` поверх индигового градиента, то есть почти чёрный текст на
 * тёмно-синем. Здесь один источник правды.
 */
type Variant = "primary" | "secondary" | "danger";

const base = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
  "transition-all disabled:cursor-not-allowed",
);

const variants: Record<Variant, string> = {
  primary: cn(
    "px-6 py-2.5 text-white shadow-lg shadow-indigo-500/30",
    "bg-linear-to-r from-indigo-600 to-blue-600",
    "hover:from-indigo-500 hover:to-blue-500",
    "disabled:from-gray-300 disabled:to-gray-400 disabled:text-gray-500 disabled:shadow-none",
    "dark:disabled:from-gray-700 dark:disabled:to-gray-600 dark:disabled:text-gray-400",
  ),
  secondary: cn(
    "px-5 py-2.5",
    "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
    "border border-gray-300 dark:border-gray-700",
    "hover:border-gray-400 dark:hover:border-gray-600",
    "text-gray-700 dark:text-gray-300",
    "disabled:opacity-60",
  ),
  danger: cn(
    "px-6 py-2.5 text-white shadow-lg shadow-red-500/30",
    "bg-red-600 hover:bg-red-500",
    "disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none",
    "dark:disabled:bg-gray-700 dark:disabled:text-gray-400",
  ),
};

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={cn(base, variants[variant], className)} {...props} />;
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
