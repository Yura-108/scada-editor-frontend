import React from 'react';
import {Checkbox} from '@/shared/ui/field/Checkbox';
import {Input} from '@/shared/ui/field/Input';
import {Textarea} from '@/shared/ui/field/Textarea';
import type {resolveParamWidget} from '@/core/devices';

/**
 * Значение параметра узла базы каналов — тем полем, которое задаёт тип параметра:
 * строка, многострочный текст или флажок («true»/«false»).
 */
export function ParamValueField({widget, value, checked, onChange}: {
  widget: ReturnType<typeof resolveParamWidget>;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
}) {
  if (widget === 'input') {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Введите значение..." />;
  }
  if (widget === 'textarea') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="resize-none"
        placeholder="Введите описание..."
      />
    );
  }
  if (widget === 'checkbox') {
    return (
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
        label={checked ? 'Включено' : 'Выключено'}
      />
    );
  }
  return null;
}
