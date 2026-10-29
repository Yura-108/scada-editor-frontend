import React from "react";
import {Field} from "@/shared/ui/field/Field";
import {Textarea} from "@/shared/ui/field/Textarea";

/**
 * Скрипты свойства. onChange бэкенд разбирает как JavaScript и при ошибке отклоняет всю
 * сцену — это ошибка поля. OnCanChange он не проверяет — о нём только предупреждаем.
 */
export function PropertyScriptFields({onChange, setOnChange, onCanChange, setOnCanChange, onChangeError, onCanChangeError}: {
  onChange: string;
  setOnChange: (value: string) => void;
  onCanChange: string;
  setOnCanChange: (value: string) => void;
  onChangeError: string | null;
  onCanChangeError: string | null;
}) {
  return (
    <>
      <Field label="onChange" error={onChangeError && `Синтаксическая ошибка: ${onChangeError}`}>
        <Textarea
          value={onChange}
          onChange={(e) => setOnChange(e.target.value)}
          placeholder="JavaScript-код обработчика изменения"
          rows={5}
          className="min-h-28"
        />
      </Field>

      <Field label="OnCanChange">
        <Textarea
          value={onCanChange}
          onChange={(e) => setOnCanChange(e.target.value)}
          placeholder="JavaScript-код проверки возможности изменения"
          rows={5}
          className="min-h-28"
        />
        {onCanChangeError && (
          <p className="text-xs text-warning">Похоже на синтаксическую ошибку: {onCanChangeError}</p>
        )}
      </Field>
    </>
  );
}
