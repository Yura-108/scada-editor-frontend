"use client";

import React, {useMemo, useState, useEffect} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import {ChevronDown, List, TextCursorInput, Type, Waypoints} from "lucide-react";
import DeviceTreePanel from "@/components/channels/DeviceTreePanel";
import SelectItem from "@/components/ui/SelectItem";
import {selectContentClassName, selectIconClassName, selectTriggerClassName} from "@/components/ui/selectStyles";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useDeviceStore} from "@/store/useDeviceStore";
import {useEditorStore} from "@/store/useEditorStore";
import {PropertyCreateDto} from "@/types/tags.types";

interface Props {
  component_id: number;
  property?: PropertyCreateDto;
}

type PropertyType = "Тег" | "Глобальный" | "Локальный";

const propertyTypeOptions: Array<{ value: PropertyType; label: string }> = [
  {value: "Тег", label: "Тег"},
  {value: "Глобальный", label: "Глобальный"},
  {value: "Локальный", label: "Локальный"},
];

export function AddPropertyContent({component_id, property}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);
  const addTags = useEditorStore((s) => s.addTags);
  const editProperty = useEditorStore((s) => s.editProperty);

  const [name, setName] = useState(property?.name || "");
  const [propertyType, setPropertyType] = useState<PropertyType>((property?.property_type as PropertyType) || "Тег");
  const [description, setDescription] = useState(property?.description || "");
  const [valueType, setValueType] = useState(property?.value_type || "");
  const [defaultValue, setDefaultValue] = useState(property?.default_value || "");
  const [logging, setLogging] = useState(property?.logging || false);
  const [onChange, setOnChange] = useState(property?.onChange || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setName(property?.name || "");
    setPropertyType((property?.property_type as PropertyType) || "Тег");
    setDescription(property?.description || "");
    setValueType(property?.value_type || "");
    setDefaultValue(property?.default_value || "");
    setLogging(property?.logging || false);
    setOnChange(property?.onChange || "");
  }, [property]);

  const isTagType = propertyType === "Тег";
  const canConfirm = useMemo(
    () => !isLoading && (!isTagType || Boolean(selectedDevice) || Boolean(property?.tag_id)),
    [isLoading, isTagType, selectedDevice, property?.tag_id]
  );

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setIsLoading(true);
    try {
      const payload = {
        name: name.trim(),
        component_id,
        property_type: propertyType,
        tag_id: isTagType ? (selectedDevice ?? property?.tag_id ?? "") : "",
        description: description.trim(),
        value_type: valueType.trim(),
        default_value: defaultValue,
        logging,
        onChange: onChange.trim(),
      };

      if (property?.id) {
        await editProperty(property.id, payload);
      } else {
        await addTags(payload);
      }

      closeModal();
    } catch (error) {
      console.error("Failed to add property:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = cn(
    "w-full rounded-xl border border-gray-700/80 bg-gray-900/60 px-4 py-3.5",
    "text-gray-100 placeholder:text-gray-600 outline-hidden",
    "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
    "transition-all shadow-sm"
  );

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1">
          {property ? "Редактирование свойства" : "Добавление свойства"}
        </Dialog.Title>

        <Dialog.Description className="text-gray-400 text-sm">
          Выберите тип свойства и заполните данные для сохранения.
        </Dialog.Description>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
            Название
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SystemName"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
            Тип свойства
          </label>
          <Select.Root value={propertyType} onValueChange={(value) => setPropertyType(value as PropertyType)}>
            <Select.Trigger className={cn(selectTriggerClassName, inputClass)}>
              <Select.Value placeholder="Выберите тип свойства" />
              <Select.Icon>
                <ChevronDown className={selectIconClassName} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" sideOffset={6} className={selectContentClassName}>
                <Select.Viewport className="p-1.5">
                  <Select.Group>
                    {propertyTypeOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </Select.Group>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
              Описание
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание свойства"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
              Тип значения
            </label>
            <input
              type="text"
              value={valueType}
              onChange={(e) => setValueType(e.target.value)}
              placeholder="string, number, boolean..."
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
              Значение по умолчанию
            </label>
            <div className="relative">
              <input
                type="text"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder="Введите значение"
                className={cn(inputClass, "pr-11")}
              />
              <Type className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
              Логирование
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-gray-700/80 bg-gray-900/60 px-4 py-3.5 text-sm text-gray-200 shadow-sm">
              <input
                type="checkbox"
                checked={logging}
                onChange={(e) => setLogging(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500/40"
              />
              Включить логирование
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
            onChange
          </label>
          <div className="relative">
            <textarea
              value={onChange}
              onChange={(e) => setOnChange(e.target.value)}
              placeholder="Код/описание обработчика изменения"
              rows={5}
              className={cn(inputClass, "min-h-28 resize-y pr-11")}
            />
            <TextCursorInput className="absolute right-4 top-4 h-5 w-5 text-gray-600 pointer-events-none" />
          </div>
        </div>

        {isTagType ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Waypoints className="h-4 w-4 text-indigo-400" />
              Выберите тег в дереве устройств
            </div>

            <div className="h-[360px] overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/70">
              <DeviceTreePanel />
            </div>

            <p className="text-xs text-gray-500">
              {selectedDevice
                ? `Выбран тег: ${selectedDevice}`
                : "Пока тег не выбран — кнопка сохранения будет недоступна."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-800 bg-gray-950/50 px-4 py-3 text-sm text-gray-400 flex items-start gap-3">
            <List className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
            <span>
              Для типа <span className="text-gray-200">{propertyType}</span> поле <span className="text-gray-200">tag_id</span> будет пустым.
            </span>
          </div>
        )}
      </div>

      <div className="shrink-0 mt-6 pt-4 flex gap-3 justify-end border-t border-gray-800/80">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors text-gray-300"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white shadow-lg shadow-indigo-900/30 transition-all disabled:shadow-none"
        >
          {isLoading ? "Сохранение..." : (property ? "Сохранить" : "Добавить свойство")}
        </button>
      </div>
    </div>
  );
}

export default function OpenAddPropertyModal(props: Props) {
  const {openModal} = useModalStore.getState();

  openModal(<AddPropertyContent {...props} />);
}
