'use client';

import React from 'react';
import {toast} from "sonner";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {isParamChecked, removeParam, resolveParamWidget} from "@/core/devices";
import type {DeviceParamsType} from "@/core/devices";
import ParamWrapper from "./ParamWrapper";
import {ParamValueField} from "./ParamValueField";

/** Сетка обычных параметров устройства: значение с учётом черновика, удаление с подтверждением. */
export function ParamGrid({normalParams, editedParams, errors, handleChange}: {
  normalParams: DeviceParamsType[];
  editedParams: Map<string, string>;
  errors: Map<string, string>;
  handleChange: (key: string, value: string) => void;
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
            onRemove={handleRemoveParam}
          >
            <ParamValueField
              widget={widget}
              value={value}
              checked={checked}
              error={errors.get(keyStr)}
              onChange={(next) => handleChange(keyStr, next)}
            />
          </ParamWrapper>
        );
      })}


    </div>
  );
}
