"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useContext, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { DialogFrameContext } from "./DialogFrame";

/**
 * Части окна внутри `DialogFrame`: шапка, тело, подвал.
 *
 * `separated` — линия между частью и прокручиваемым телом. Окну с длинным содержимым
 * она нужна: видно, где кончается список и начинаются кнопки. Короткому вопросу
 * (подтверждение, ввод имени) — нет: там нечему прокручиваться.
 */

/**
 * Заголовок и описание окна. Radix берёт из них имя и описание диалога для скринридера,
 * поэтому описание всегда в DOM: без текста — скрыто визуально и повторяет заголовок.
 */
export function DialogHeader({
  title,
  description,
  icon,
  separated = true,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Значок слева от заголовка (например, у подтверждений). */
  icon?: ReactNode;
  separated?: boolean;
  className?: string;
}) {
  const { showClose } = useContext(DialogFrameContext);

  return (
    <div
      className={cn(
        "flex items-start gap-4 pl-6",
        showClose ? "pr-14" : "pr-6",
        // Без линии — шапка короткого вопроса, и всё сообщение в ней. Длинное описание
        // (список тегов для записи в ПЛК) прокручивается в самой шапке, кнопки остаются на экране.
        separated ? "shrink-0 border-b py-4" : "min-h-0 overflow-y-auto pt-6 pb-2",
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <Dialog.Title className="text-lg font-semibold leading-snug">{title}</Dialog.Title>
        {/* `asChild` + `div`, а не абзац по умолчанию: описание бывает с разметкой — список
            записываемых в ПЛК тегов, перечень мест в коде. `<ul>`/`<div>` внутри `<p>`
            браузер закрывает досрочно, и разметка сервера расходится с клиентской
            (ошибка гидрации). */}
        <Dialog.Description asChild>
          <div className={description ? "mt-1 text-sm text-muted-foreground" : "sr-only"}>
            {description ?? title}
          </div>
        </Dialog.Description>
      </div>
    </div>
  );
}

/** Прокручиваемое содержимое окна между шапкой и подвалом. */
export function DialogBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className)}>{children}</div>;
}

/** Ряд кнопок внизу окна, прижат вправо. Главное действие — последним. */
export function DialogFooter({
  separated = true,
  className,
  children,
}: {
  separated?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap justify-end gap-3 px-6",
        separated ? "border-t py-4" : "pt-4 pb-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
