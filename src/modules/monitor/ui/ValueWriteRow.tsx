import React from "react";
import {Button} from "@/shared/ui/Button";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Input} from "@/shared/ui/field/Input";

/**
 * Ввод нового значения и кнопка записи — строка свойства в «Опциях» элемента и в инспекторе
 * объекта. Логическое значение — флажок (черновик "true"/"false"), остальное — поле.
 * Запись в ПЛК — красная кнопка: это действие на живом оборудовании.
 */
export function ValueWriteRow({isBool, numeric, draft, onDraft, onWrite, disabled, label, danger, submitOnEnter}: {
  isBool: boolean;
  numeric: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onWrite: () => void;
  disabled: boolean;
  label: string;
  /** true — пишется в ПЛК (кнопка красная), false — локальное значение. */
  danger: boolean;
  /** Enter в поле записывает (если значение не пустое). */
  submitOnEnter?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pl-7">
      {isBool ? (
        <Checkbox
          className="flex-1"
          checked={draft === "true"}
          onChange={(e) => onDraft(e.target.checked ? "true" : "false")}
          label={draft === "true" ? "true" : "false"}
        />
      ) : (
        <Input
          size="sm"
          className="flex-1"
          type={numeric ? "number" : "text"}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={submitOnEnter ? (e) => { if (e.key === "Enter" && draft.trim()) onWrite(); } : undefined}
          placeholder="Новое значение"
        />
      )}
      <Button size="sm" variant={danger ? "danger" : "primary"} className="shrink-0" onClick={onWrite} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}
