"use client";

import React, {useMemo, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import {ChevronDown, List, TextCursorInput, Type, Waypoints} from "lucide-react";
import DeviceTreePanel from "@/components/channels/DeviceTreePanel";
import SelectItem from "@/components/ui/SelectItem";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useDeviceStore} from "@/store/useDeviceStore";
import {useEditorStore} from "@/store/useEditorStore";

interface Props {
  component_id: number;
}

type PropertyType = "Тег" | "Глобальный" | "Локальный";

const propertyTypeOptions: Array<{ value: PropertyType; label: string }> = [
  {value: "Тег", label: "Тег"},
  {value: "Глобальный", label: "Глобальный"},
  {value: "Локальный", label: "Локальный"},
];

export function AddPropertyContent({component_id}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);
  const addTags = useEditorStore((s) => s.addTags);

  const [propertyType, setPropertyType] = useState<PropertyType>("Тег");
  const [description, setDescription] = useState("");
  const [valueType, setValueType] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [logging, setLogging] = useState(false);
  const [onChange, setOnChange] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isTagType = propertyType === "Тег";
  const canConfirm = useMemo(
    () => !isLoading && (!isTagType || Boolean(selectedDevice)),
    [isLoading, isTagType, selectedDevice]
  );

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setIsLoading(true);
    try {
      await addTags({
        component_id,
        property_type: propertyType,
        tag_id: isTagType ? (selectedDevice ?? "") : "",
        description: description.trim(),
        value_type: valueType.trim(),
        default_value: defaultValue,
        logging,
        onChange: onChange.trim(),
      });
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
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Добавление свойства
      </Dialog.Title>

      <Dialog.Description className="text-gray-400 mb-6 text-sm">
        Выберите тип свойства и заполните данные для сохранения.
      </Dialog.Description>

      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
            Тип свойства
          </label>
          <Select.Root value={propertyType} onValueChange={(value) => setPropertyType(value as PropertyType)}>
            <Select.Trigger className={cn(inputClass, "flex items-center justify-between gap-2")}>
              <Select.Value placeholder="Выберите тип свойства" />
              <Select.Icon>
                <ChevronDown className="h-5 w-5 opacity-70" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={6}
                className={cn(
                  "z-100 min-w-(--radix-select-trigger-width) max-h-64 overflow-hidden",
                  "rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/60"
                )}
              >
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

      <div className="mt-8 flex gap-3 justify-end">
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
          {isLoading ? "Сохранение..." : "Добавить свойство"}
        </button>
      </div>
    </>
  );
}

export default function OpenAddPropertyModal(component_id: number) {
  const {openModal} = useModalStore.getState();

  openModal(<AddPropertyContent component_id={component_id} />);
}

