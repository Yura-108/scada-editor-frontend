import React from "react";
import {Loader2} from "lucide-react";
import {cn} from "@/shared/lib/cn";

/**
 * Индикатор загрузки. Один на приложение: раньше рядом жили `Loader2`, своё кольцо на CSS
 * и SVG на странице входа, у каждого свой размер и цвет.
 *
 * - `<Spinner />` — значок в кнопке вместо её иконки, пока идёт действие;
 * - `<Spinner label="Загрузка…" />` — строка в списке или панели;
 * - `<Spinner label="Загрузка…" fill />` — по центру свободного места страницы или панели.
 *
 * С подписью это `role="status"`: скринридер сообщит о загрузке. Без подписи значок
 * декоративный — о занятости говорит сама кнопка (`disabled`, текст «Сохранение…»).
 */
export function Spinner({
  size = 14,
  label,
  fill = false,
  className,
}: {
  size?: number;
  label?: React.ReactNode;
  fill?: boolean;
  className?: string;
}) {
  if (!label) return <Loader2 size={size} aria-hidden className={cn("shrink-0 animate-spin", className)} />;

  return (
    <span
      role="status"
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        fill && "flex-1 justify-center p-6",
        className,
      )}
    >
      <Loader2 size={size} aria-hidden className="shrink-0 animate-spin" />
      {label}
    </span>
  );
}
