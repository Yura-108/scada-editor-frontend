"use client";

import React, {useId, useState} from "react";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {ColorField} from "@/shared/ui/field/ColorField";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {NumberInput} from "@/shared/ui/field/NumberInput";
import {SearchInput} from "@/shared/ui/field/SearchInput";
import {TextInput} from "@/shared/ui/field/TextInput";
import {Textarea} from "@/shared/ui/field/Textarea";
import type {FieldSize} from "@/shared/ui/field/fieldStyles";
import {CatalogSection, Demo} from "../CatalogSection";

export function FieldsSection() {
  return (
    <CatalogSection
      id="fields"
      title="Поля"
      description="Всё из shared/ui/field. Field даёт подпись, подсказку и ошибку и связывает их с полем. Input — обычное поле формы; TextInput и NumberInput применяют значение по Enter или уходу с поля (панель свойств)."
    >
      <Fields />
    </CatalogSection>
  );
}

function Fields() {
  const [text, setText] = useState("Насос 1");
  const [num, setNum] = useState(42);
  const [color, setColor] = useState("#3b82f6");
  const [checked, setChecked] = useState(true);
  const colorId = useId();

  return (
    <>
      {(["md", "sm"] as FieldSize[]).map(size => (
        <Demo key={size} label={`size="${size}"`} className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          <Field label="Input" size={size} hint="Подсказка под полем">
            <Input size={size} placeholder="Введите имя" />
          </Field>
          <Field label="С ошибкой" size={size} error="Имя уже занято">
            <Input size={size} defaultValue="Насос 1" />
          </Field>
          <Field label="TextInput" size={size}>
            <TextInput size={size} value={text} onCommit={setText} />
          </Field>
          <Field label="NumberInput (0–100)" size={size}>
            <NumberInput size={size} value={num} onCommit={setNum} min={0} max={100} />
          </Field>
          <Field label="disabled" size={size}>
            <Input size={size} disabled defaultValue="Только чтение" />
          </Field>
        </Demo>
      ))}
      <Demo label="SearchInput" className="block">
        <SearchInput placeholder="Поиск по тегам" />
      </Demo>
      <Demo label="Textarea" className="block">
        <Field label="Комментарий">
          <Textarea rows={3} placeholder="Что изменилось в выпуске" />
        </Field>
      </Demo>
      <Demo label="Checkbox">
        <Checkbox label="Включено" checked={checked} onChange={e => setChecked(e.target.checked)} />
        <Checkbox label="disabled" disabled />
      </Demo>
      <Demo label="ColorField" className="block">
        <ColorField id={colorId} label="Цвет заливки" value={color} onChange={setColor} />
      </Demo>
    </>
  );
}
