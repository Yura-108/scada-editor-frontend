import React from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/shared/lib/cn";

/**
 * Что показать, когда показывать нечего: проект не выбран, у узла нет параметров, у
 * элемента нет привязок. Не просто «пусто», а почему и что сделать дальше.
 *
 * - `md` — по центру свободного места страницы или панели, со значком в круге;
 * - `sm` — компактно внутри списка или вкладки.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "md",
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Кнопка следующего шага («Создать», «Выбрать проект»). */
  action?: React.ReactNode;
  size?: "md" | "sm";
  className?: string;
}) {
  if (size === "sm") {
    return (
      <div className={cn("flex flex-col items-center gap-1 px-3 py-6 text-center text-sm text-muted-foreground", className)}>
        {Icon && <Icon size={20} aria-hidden className="mb-1 opacity-60" />}
        <p>{title}</p>
        {description && <p className="text-xs">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-1 items-center justify-center p-6", className)}>
      <div className="max-w-md text-center">
        {Icon && (
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="h-7 w-7" aria-hidden />
          </div>
        )}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
