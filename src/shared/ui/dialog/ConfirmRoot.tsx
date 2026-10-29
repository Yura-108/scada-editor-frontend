"use client";

import { AlertTriangle, HelpCircle } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";
import { DialogFrame } from "./DialogFrame";
import { DialogBody, DialogFooter, DialogHeader } from "./DialogParts";
import { useConfirmStore, type ConfirmEntry } from "./confirmStore";

type EntryOf<K extends ConfirmEntry["kind"]> = Extract<ConfirmEntry, {kind: K}>;
type DialogProps<K extends ConfirmEntry["kind"]> = { entry: EntryOf<K>; depth: number };

/**
 * Ответ вызывающему `await` и снятие окна со стека. Любое закрытие без выбора (Esc,
 * клик по затемнению) — тоже ответ: отказ. Иначе `await confirmModal()` повис бы навсегда.
 */
function useSettle<T>(entry: { id: number; resolve: (value: T) => void }) {
  const remove = useConfirmStore((s) => s.remove);
  return (value: T) => {
    entry.resolve(value);
    remove(entry.id);
  };
}

function QuestionIcon({ danger }: { danger: boolean }) {
  return (
    <div
      className={cn(
        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
      )}
    >
      {danger ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
    </div>
  );
}

function ConfirmDialog({ entry, depth }: DialogProps<"confirm">) {
  const settle = useSettle(entry);
  const {
    title,
    description,
    confirmLabel = "Подтвердить",
    cancelLabel = "Отмена",
    danger = false,
    wide = false,
  } = entry.options;

  return (
    <DialogFrame layer="confirm" depth={depth} size={wide ? "lg" : "sm"} showClose={false} onClose={() => settle(false)}>
      <DialogHeader separated={false} icon={<QuestionIcon danger={danger} />} title={title} description={description} />
      <DialogFooter separated={false}>
        <Button onClick={() => settle(false)}>{cancelLabel}</Button>
        <Button variant={danger ? "danger" : "primary"} autoFocus onClick={() => settle(true)}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogFrame>
  );
}

function ChoiceDialog({ entry, depth }: DialogProps<"choice">) {
  const settle = useSettle(entry);
  const { title, description, options, cancelLabel = "Отмена" } = entry.options;

  return (
    <DialogFrame layer="confirm" depth={depth} size="sm" showClose={false} onClose={() => settle(null)}>
      <DialogHeader separated={false} title={title} description={description} />
      {/* Варианты столбцом, а не в ряд: у каждого есть пояснение, и в строку они
          превращаются в кнопки без подписей — то есть в угадайку. */}
      <DialogBody className="flex flex-col gap-2">
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            autoFocus={index === 0}
            onClick={() => settle(option.id)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors",
              option.danger ? "border-destructive/40 hover:bg-destructive/10" : "border-input hover:bg-accent",
            )}
          >
            <div className={cn("font-medium", option.danger && "text-destructive")}>{option.label}</div>
            {option.description && (
              <div className="mt-0.5 text-xs text-muted-foreground">{option.description}</div>
            )}
          </button>
        ))}
      </DialogBody>
      <DialogFooter separated={false}>
        <Button onClick={() => settle(null)}>{cancelLabel}</Button>
      </DialogFooter>
    </DialogFrame>
  );
}

function PromptDialog({ entry, depth }: DialogProps<"prompt">) {
  const settle = useSettle(entry);
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

  const canSubmit = allowEmpty || value.trim().length > 0;
  const submit = () => { if (canSubmit) settle(value.trim()); };

  return (
    <DialogFrame layer="confirm" depth={depth} size="sm" showClose={false} onClose={() => settle(null)}>
      <DialogHeader separated={false} title={title} description={description} />
      <DialogBody className="space-y-2">
        <label htmlFor={inputId} className="ml-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
            "w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground outline-hidden",
            "placeholder:text-muted-foreground transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20",
          )}
        />
      </DialogBody>
      <DialogFooter separated={false}>
        <Button onClick={() => settle(null)}>Отмена</Button>
        <Button variant="primary" onClick={submit} disabled={!canSubmit}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogFrame>
  );
}

/**
 * Точка монтирования подтверждений. Ставится в layout рядом с `ModalRoot`; слой `confirm`
 * держит их поверх любого окна, из которого их спросили.
 */
export function ConfirmRoot() {
  const stack = useConfirmStore((s) => s.stack);

  return stack.map((entry, depth) => {
    if (entry.kind === "confirm") return <ConfirmDialog key={entry.id} entry={entry} depth={depth} />;
    if (entry.kind === "choice") return <ChoiceDialog key={entry.id} entry={entry} depth={depth} />;
    return <PromptDialog key={entry.id} entry={entry} depth={depth} />;
  });
}
