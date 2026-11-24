'use client';

import React from 'react';
import {toast} from "sonner";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {isParamChecked, paramChoices, removeParam, resolveParamWidget} from "@/core/devices";
import type {DeviceParamsType} from "@/core/devices";
import ParamWrapper from "./ParamWrapper";
import {ParamValueField} from "./ParamValueField";

/** Сетка обычных параметров устройства: значение с учётом черновика, удаление с подтверждением. */
export function ParamGrid({normalParams, editedParams, errors, handleChange, readOnly = false}: {
  normalParams: DeviceParamsType[];
  editedParams: Map<string, string>;
  errors: Map<string, string>;
  handleChange: (key: string, value: string) => void;
  /** Вне режима правки: без крестиков «Удалить параметр» — они всё равно не работали. */
  readOnly?: boolean;
}) {
  const handleRemoveParam = async (key: string) => {
    const confirmed = await confirmModal({
      title: 'Удалить параметр?',
      description: 'Параметр будет удалён безвозвратно.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await removeParam(key);
      toast.success('Параметр удалён');
    } catch (err) {
      // Раньше ошибка уходила только в консоль: строка оставалась на экране,
      // и пользователь считал, что удаление прошло.
      console.error('Ошибка при удалении параметра:', err);
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить параметр');
    }
  }

  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
      {normalParams.map((param) => {
        const keyStr = String(param.key);
        const value = editedParams.get(keyStr) ?? param.value ?? '';
        const hasChanged = (param.value || '') !== value;
        const widget = resolveParamWidget(param.type);
        const checked = isParamChecked(value);

        return (
          <ParamWrapper
            key={param.key}
            param={param}
            hasChanged={hasChanged}
            onRemove={readOnly ? undefined : handleRemoveParam}
          >
            <ParamValueField
              widget={widget}
              name={param.name}
              value={value}
              checked={checked}
              choices={widget === 'input' ? paramChoices(param.name, value) : null}
              error={errors.get(keyStr)}
              onChange={(next) => handleChange(keyStr, next)}
            />
          </ParamWrapper>
        );
      })}


    </div>
  );
}
