"use client";

import React from "react";
import {Trash2} from "lucide-react";
import {isBooleanValueType} from "@/core/scene";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {Button} from "@/shared/ui/Button";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import {ACCESS_LEVEL_MAX, ACCESS_LEVEL_MIN, PROPERTY_TYPE_OPTIONS, VALUE_TYPE_OPTIONS, type PropertyType} from "./propertyOptions";
import {usePropertyForm, type PropertyFormProps} from "./usePropertyForm";
import {PropertyScriptFields} from "./PropertyScriptFields";
import {PropertyTagSource} from "./PropertyTagSource";

/** Окно свойства элемента: добавление нового или правка существующего. */
export function AddPropertyContent(props: PropertyFormProps) {
  const f = usePropertyForm(props);
  const {property} = props;

  return (
    <>
      <DialogHeader
        title={property ? "Редактирование свойства" : "Добавление свойства"}
        description="Выберите тип свойства и заполните данные для сохранения."
      />

      <DialogBody className="space-y-5">
        <Field label="Название">
          <Input value={f.name} onChange={(e) => f.setName(e.target.value)} placeholder="SystemName" />
        </Field>

        {/* Имя — для оператора; «Название» занято скриптами */}
        <Field label="Имя">
          <Input value={f.label} onChange={(e) => f.setLabel(e.target.value)} placeholder="Как свойство видит оператор" />
        </Field>

        <Field label="Тип свойства">
          <Select
            value={f.propertyType}
            onValueChange={(v) => f.setPropertyType(v as PropertyType)}
            placeholder="Выберите тип свойства"
            options={PROPERTY_TYPE_OPTIONS}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Имя для шлюза">
            <Input value={f.gatewayName} onChange={(e) => f.setGatewayName(e.target.value)} placeholder="OBJECT10.S_PAR_F[ 4 ]" />
          </Field>
          <Field label="Тип значения">
            <Select value={f.valueType} onValueChange={f.setValueType} placeholder="Выберите тип значения" options={VALUE_TYPE_OPTIONS} />
          </Field>
        </div>

        <Field label="Значение по умолчанию">
          {isBooleanValueType(f.valueType) ? (
            <Checkbox
              checked={f.defaultValue === "true"}
              onChange={(e) => f.setDefaultValue(e.target.checked ? "true" : "false")}
              label={f.defaultValue === "true" ? "true" : "false"}
            />
          ) : (
            <Input value={f.defaultValue} onChange={(e) => f.setDefaultValue(e.target.value)} placeholder="Введите значение" />
          )}
        </Field>

        <Field label="Уровень доступа">
          <Input
            type="number"
            className="max-w-40"
            min={ACCESS_LEVEL_MIN}
            max={ACCESS_LEVEL_MAX}
            value={f.accessLevel}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isNaN(value)) return;
              f.setAccessLevel(Math.min(ACCESS_LEVEL_MAX, Math.max(ACCESS_LEVEL_MIN, value)));
            }}
          />
        </Field>

        <PropertyScriptFields
          onChange={f.onChange}
          setOnChange={f.setOnChange}
          onCanChange={f.onCanChange}
          setOnCanChange={f.setOnCanChange}
          onChangeError={f.onChangeError}
          onCanChangeError={f.onCanChangeError}
        />

        <PropertyTagSource
          isTagType={f.isTagType}
          propertyType={f.propertyType}
          tagSource={f.tagSource}
          onTagSource={f.setTagSource}
          channelTag={f.channelTag}
          onChannelTag={f.setChannelTag}
          variables={f.variables}
          variableName={f.variableName}
          onChooseVariable={f.chooseVariable}
        />
      </DialogBody>

      <DialogFooter>
        {property?.id ? (
          <Button variant="danger" onClick={f.handleDelete} disabled={f.isLoading} className="mr-auto">
            <Trash2 size={16} />
            Удалить свойство
          </Button>
        ) : null}
        {f.missing && <span className="mr-auto self-center text-xs text-warning">{f.missing}</span>}
        <Button onClick={f.closeModal}>Отмена</Button>
        <Button variant="primary" onClick={f.handleConfirm} disabled={!f.canConfirm} title={f.missing ?? undefined}>
          {f.isLoading ? "Сохранение..." : property ? "Сохранить" : "Добавить свойство"}
        </Button>
      </DialogFooter>
    </>
  );
}

export default function OpenAddPropertyModal(props: PropertyFormProps) {
  useModalStore.getState().openModal(<AddPropertyContent {...props} />, {size: "xl", closeOnOverlay: false});
}
