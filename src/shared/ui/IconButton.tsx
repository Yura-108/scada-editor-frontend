"use client";

import React from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Spinner} from "./Spinner";

/**
 * - `ghost` — без рамки: панели инструментов, строки списков и таблиц;
 * - `secondary` — с рамкой, как `Button` по умолчанию: рядом с обычными кнопками в одной строке;
 * - `danger` — без рамки, при наведении красная: удалить строку, убрать тег.
 */
type Variant = "ghost" | "secondary" | "danger";
/** `xs` — 24px (строки, деревья, чипы), `sm` — 32px, `md` — 40px: вровень с `Button` и полями. */
type Size = "xs" | "sm" | "md";

const variants: Record<Variant, string> = {
  ghost: "border-transparent text-muted-foreground enabled:hover:bg-accent enabled:hover:text-foreground",
  secondary: "border-input text-foreground enabled:hover:bg-accent",
  danger: "border-transparent text-muted-foreground enabled:hover:bg-destructive/10 enabled:hover:text-destructive",
};

const sizes: Record<Size, {box: string; icon: number}> = {
  xs: {box: "h-6 w-6 rounded-md", icon: 14},
  sm: {box: "h-8 w-8 rounded-lg", icon: 14},
  md: {box: "h-10 w-10 rounded-lg", icon: 16},
};

/**
 * Кнопка из одной иконки. Подпись обязательна: она же `aria-label` для скринридера и
 * подсказка при наведении — у кнопки без текста иначе нет имени, и такие уже были.
 * `title` задаётся отдельно, когда подсказка должна объяснять больше подписи (почему
 * кнопка неактивна).
 */
export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "sm",
  busy = false,
  pressed,
  title,
  className,
  type = "button",
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  icon: LucideIcon;
  label: string;
  variant?: Variant;
  size?: Size;
  /** Идёт действие: вместо иконки крутится `Spinner`. */
  busy?: boolean;
  /**
   * Кнопка-переключатель («Зафиксировать вид»): `true`/`false` — нажата или нет, подсвечена
   * акцентом. Не задано — обычная кнопка, `aria-pressed` не ставится.
   */
  pressed?: boolean;
}) {
  const {box, icon} = sizes[size];
  return (
    <button
      type={type}
      aria-label={label}
      aria-busy={busy || undefined}
      aria-pressed={pressed}
      title={title ?? label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        box,
        variants[variant],
        pressed && "bg-primary/15 text-primary enabled:hover:bg-primary/20 enabled:hover:text-primary",
        className,
      )}
      {...props}
    >
      {busy ? <Spinner size={icon} /> : <Icon size={icon} aria-hidden />}
    </button>
  );
}
