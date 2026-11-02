import React from "react";
import {Field} from "@/shared/ui/field/Field";
import {Textarea} from "@/shared/ui/field/Textarea";
import {ASSISTANT_TASK_MAX} from "../../types/assistant.types";

/** Задание помощнику не длиннее предела контракта (иначе сервер ответит 400). */
export const isTaskValid = (task: string) => task.trim().length > 0 && task.length <= ASSISTANT_TASK_MAX;

/** Поле задания помощнику со счётчиком символов. */
export function AssistantTaskField({label = "Задание", value, onChange, placeholder, disabled}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const tooLong = value.length > ASSISTANT_TASK_MAX;
  return (
    <Field
      label={label}
      error={tooLong ? `Не длиннее ${ASSISTANT_TASK_MAX} символов (сейчас ${value.length})` : undefined}
      hint={tooLong ? undefined : `${value.length} / ${ASSISTANT_TASK_MAX}`}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
      />
    </Field>
  );
}
