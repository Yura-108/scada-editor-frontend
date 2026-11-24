import React from 'react';
import {Checkbox} from '@/shared/ui/field/Checkbox';
import {Input} from '@/shared/ui/field/Input';
import {Select} from '@/shared/ui/field/Select';
import {Textarea} from '@/shared/ui/field/Textarea';
import type {ParamChoice, resolveParamWidget} from '@/core/devices';

/**
 * Значение параметра узла базы каналов — тем полем, которое задаёт тип параметра:
 * строка, многострочный текст или флажок («true»/«false»).
 */
export function ParamValueField({widget, name, value, checked, choices, error, onChange}: {
  widget: ReturnType<typeof resolveParamWidget>;
  /** Имя параметра — подпись флажка для скринридера: на экране она уже в заголовке карточки. */
  name: string;
  value: string;
  checked: boolean;
  /**
   * Значение-код со списком расшифровок («Протокол», «Тип опроса», «Тип данных») — выпадающий
   * список вместо поля, куда можно было вписать что угодно (#16 п. 7).
   */
  choices?: {options: ParamChoice[]; value: string} | null;
  /** Ошибка значения («Должно быть число») — поле подсвечено, текст под ним. */
  error?: string | null;
  onChange: (value: string) => void;
}) {
  if (widget === 'input' && choices) {
    return <Select value={choices.value} onValueChange={onChange} options={choices.options} placeholder="Не задано" aria-label={name} />;
  }
  if (widget === 'input') {
    return (
      <div className="space-y-1.5">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Введите значение..." aria-invalid={error ? true : undefined} />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
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
        // Без второго слова рядом с галочкой: «Включен — ☐ Выключено» читалось как два
        // противоречащих состояния (#16 п. 7). Состояние видно по самой галочке.
        aria-label={name}
      />
    );
  }
  return null;
}
