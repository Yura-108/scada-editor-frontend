import React from "react";
import {cn} from "@/shared/lib/cn";

/**
 * Каркас рабочей страницы: под шапкой приложения, на всю оставшуюся высоту, колонкой —
 * сверху `PageHeader`, под ним плашки и содержимое (`flex-1 min-h-0`). Страница сама не
 * прокручивается: прокручиваются её панели.
 */
export function PageFrame({className, children}: {className?: string; children: React.ReactNode}) {
  return (
    <div
      className={cn(
        "fixed inset-0 top-(--app-header-h) flex flex-col overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
