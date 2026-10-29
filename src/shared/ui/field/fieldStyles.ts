import {cn} from "@/shared/lib/cn";

/**
 * Высота поля: `md` — окна и формы (40px), `sm` — панели и строки таблиц (32px).
 * Те же два размера, что у `Button`.
 */
export type FieldSize = "md" | "sm";

/** Рамка, фон, фокус, неактивное и ошибочное состояние — общие у всех полей. */
export const fieldBase = cn(
  "w-full rounded-lg border border-input bg-background text-foreground",
  "placeholder:text-muted-foreground outline-none transition-colors",
  "hover:border-ring focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
);

export const fieldSizes: Record<FieldSize, string> = {
  md: "h-10 px-3 text-sm",
  sm: "h-8 px-2.5 text-sm",
};
