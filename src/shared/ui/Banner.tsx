import React from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {toneStyles, type Tone} from "./tone";

/**
 * Где стоит плашка:
 * - `bar` — полоса на всю ширину под шапкой страницы («Только просмотр», ошибки набора);
 * - `box` — блок в содержимом окна или панели;
 * - `floating` — всплывает над холстом (просмотр версии, «сцену сохранил другой»): фон
 *   непрозрачный и с тенью. Положение задаёт владелец через `className`.
 */
type Layout = "bar" | "box" | "floating";

const layouts: Record<Layout, string> = {
  bar: "shrink-0 border-b px-4 py-2",
  box: "rounded-xl border px-4 py-3",
  floating: "rounded-2xl border bg-card px-4 py-2 shadow-2xl backdrop-blur-xl",
};

/**
 * Плашка с сообщением: что случилось, почему и что делать. Значок и заголовок — цветом
 * тона, сам текст — обычным: длинное объяснение цветным шрифтом на светлой теме плохо
 * читается.
 *
 * Ошибка (`destructive`) объявляется скринридеру сразу (`role="alert"`), остальное —
 * вежливо (`role="status"`). Постоянная подсказка, которую объявлять не нужно, —
 * `role="note"`.
 */
export function Banner({
  tone = "info",
  icon: Icon,
  title,
  actions,
  layout = "box",
  role,
  className,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  /** Короткая суть. В `bar` идёт в строку перед текстом, в остальных — отдельной строкой. */
  title?: React.ReactNode;
  /** Кнопки справа. */
  actions?: React.ReactNode;
  layout?: Layout;
  role?: React.AriaRole;
  className?: string;
  children?: React.ReactNode;
}) {
  const style = toneStyles[tone];
  const inlineTitle = layout === "bar";

  return (
    <div
      role={role ?? (tone === "destructive" ? "alert" : "status")}
      className={cn(
        "flex items-start gap-2 text-sm text-foreground",
        layouts[layout],
        layout === "floating" ? style.tint : style.soft,
        style.border,
        className,
      )}
    >
      {Icon && <Icon size={16} aria-hidden className={cn("mt-0.5 shrink-0", style.text)} />}
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && !inlineTitle && <div className={cn("font-medium", style.text)}>{title}</div>}
        {(children || (title && inlineTitle)) && (
          <div>
            {title && inlineTitle && <span className={cn("font-medium", style.text)}>{title} </span>}
            {children}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
