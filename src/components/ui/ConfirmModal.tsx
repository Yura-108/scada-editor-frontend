"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, HelpCircle } from "lucide-react";
import React, { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { useConfirmStore, type ConfirmEntry } from "@/store/confirmStore";
import type { ChoiceModalOptions, ConfirmModalOptions, PromptModalOptions } from "@/types/confirm.types";

export type { ChoiceModalOptions, ConfirmModalOptions, PromptModalOptions };

/**
 * Промис-обёртка вместо нативного `confirm()`.
 *
 * Нативный диалог не стилизуется, игнорирует тему, блокирует поток и в ряде
 * окружений (кросс-доменный iframe) подавляется браузером — для необратимых
 * операций вроде записи рецепта в ПЛК это неприемлемо.
 *
 * @example if (!(await confirmModal({title: "Удалить?", danger: true}))) return;
 */
export function confirmModal(options: ConfirmModalOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useConfirmStore.getState().push({kind: "confirm", options, resolve});
  });
}

/** Промис-обёртка вместо нативного `prompt()`. Резолвится `null` при отмене. */
export function promptModal(options: PromptModalOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    useConfirmStore.getState().push({kind: "prompt", options, resolve});
  });
}

/**
 * Выбор из нескольких действий. Резолвится id варианта либо `null` при отмене.
 *
 * Нужен там, где исходов больше двух и `confirmModal` пришлось бы натягивать на «да/нет»:
 * например, импорт в непустую схему — заменить, добавить или передумать. Прятать третий
 * исход за Esc нельзя, когда один из вариантов теряет работу пользователя.
 */
export function choiceModal(options: ChoiceModalOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    useConfirmStore.getState().push({kind: "choice", options, resolve});
  });
}

const cancelButtonClasses =
  "rounded-lg border border-gray-300 bg-gray-100 px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";

function ConfirmDialog({ entry }: { entry: Extract<ConfirmEntry, {kind: "confirm"}> }) {
  const remove = useConfirmStore((s) => s.remove);
  const {
    title,
    description,
    confirmLabel = "Подтвердить",
    cancelLabel = "Отмена",
    danger = false,
  } = entry.options;

  // Любое закрытие без нажатия «подтвердить» — отказ. Иначе `await confirmModal()`
  // повис бы навсегда при Esc / клике по оверлею / крестику.
  const settle = (value: boolean) => {
    entry.resolve(value);
    remove(entry.id);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) settle(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-confirm bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-confirm w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl",
            "dark:border-gray-800/70 dark:bg-[#0f0f1a] dark:text-white",
            "focus:outline-none",
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                danger
                  ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                  : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
              )}
            >
              {danger ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
            </div>

            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold leading-snug">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={() => settle(false)} className={cancelButtonClasses}>
              {cancelLabel}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => settle(true)}
              className={cn(
                "rounded-lg px-6 py-2.5 font-medium text-white shadow-lg transition-colors",
                danger
                  ? "bg-red-600 shadow-red-900/25 hover:bg-red-500"
                  : "bg-indigo-600 shadow-indigo-900/25 hover:bg-indigo-500",
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ChoiceDialog({ entry }: { entry: Extract<ConfirmEntry, {kind: "choice"}> }) {
  const remove = useConfirmStore((s) => s.remove);
  const { title, description, options, cancelLabel = "Отмена" } = entry.options;

  const settle = (value: string | null) => {
    entry.resolve(value);
    remove(entry.id);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) settle(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-confirm bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-confirm w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl",
            "dark:border-gray-800/70 dark:bg-[#0f0f1a] dark:text-white",
            "focus:outline-none",
          )}
        >
          <Dialog.Title className="text-lg font-semibold leading-snug">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}

          {/* Варианты столбцом, а не в ряд: у каждого есть пояснение, и в строку они
              превращаются в кнопки без подписей — то есть в угадайку. */}
          <div className="mt-6 flex flex-col gap-2">
            {options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                autoFocus={index === 0}
                onClick={() => settle(option.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  option.danger
                    ? "border-red-300 hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10"
                    : "border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800",
                )}
              >
                <div className={cn(
                  "font-medium",
                  option.danger ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-100",
                )}>
                  {option.label}
                </div>
                {option.description && (
                  <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                    {option.description}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button type="button" onClick={() => settle(null)} className={cancelButtonClasses}>
              {cancelLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PromptDialog({ entry }: { entry: Extract<ConfirmEntry, {kind: "prompt"}> }) {
  const remove = useConfirmStore((s) => s.remove);
  const {
    title,
    description,
    label = "Значение",
    placeholder = "Введите текст…",
    defaultValue = "",
    confirmLabel = "Сохранить",
    allowEmpty = false,
  } = entry.options;

  const [value, setValue] = useState(defaultValue);
  const inputId = useId();

  const settle = (result: string | null) => {
    entry.resolve(result);
    remove(entry.id);
  };

  const canSubmit = allowEmpty || value.trim().length > 0;
  const submit = () => { if (canSubmit) settle(value.trim()); };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) settle(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-confirm bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-confirm w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl",
            "dark:border-gray-800/70 dark:bg-[#0f0f1a] dark:text-white",
            "focus:outline-none",
          )}
        >
          <Dialog.Title className="mb-1 text-xl font-semibold">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}

          <div className="space-y-2">
            <label
              htmlFor={inputId}
              className="ml-1 text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              {label}
            </label>
            <input
              id={inputId}
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder={placeholder}
              className={cn(
                "w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 dark:border-gray-700/80 dark:bg-gray-900/60",
                "text-gray-900 placeholder:text-gray-500 outline-hidden dark:text-gray-100 dark:placeholder:text-gray-400",
                "transition-all hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
              )}
            />
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={() => settle(null)} className={cancelButtonClasses}>
              Отмена
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-indigo-900/25 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Точка монтирования диалогов подтверждения. Ставится в layout рядом с ModalRoot;
 * собственный стек позволяет открывать подтверждение поверх обычной модалки.
 */
export function ConfirmRoot() {
  const stack = useConfirmStore((s) => s.stack);

  return (
    <>
      {stack.map((entry) => {
        if (entry.kind === "confirm") return <ConfirmDialog key={entry.id} entry={entry} />;
        if (entry.kind === "choice") return <ChoiceDialog key={entry.id} entry={entry} />;
        return <PromptDialog key={entry.id} entry={entry} />;
      })}
    </>
  );
}
