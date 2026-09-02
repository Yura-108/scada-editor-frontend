"use client";

import React, { useMemo, useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, List, TextCursorInput, Trash2, Type, Waypoints } from "lucide-react";
import DeviceTreePanel from "@/components/channels/DeviceTreePanel";
import SelectItem from "@/components/ui/SelectItem";
import { selectContentClassName, selectIconClassName, selectTriggerClassName } from "@/components/ui/selectStyles";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/store/modalStore";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useEditorStore } from "@/store/useEditorStore";
import { PropertyCreateDto } from "@/types/tags.types";
import { isBooleanValueType } from "@/lib/editor/valueTypes";
import { Button, ModalFooter } from "@/components/ui/Button";
import { confirmDeleteProperty } from "@/lib/editor/confirmDeleteProperty";

interface Props {
  /**
   * Ключ элемента-владельца. Адресуем именно ключом, а не серверным `component_id`:
   * свойство теперь можно завести элементу, которого на сервере ещё нет (id === null),
   * и по id такой элемент не находится.
   */
  elementKey: string;
  property?: PropertyCreateDto;
}

type PropertyType = "Тег" | "Глобальный" | "Локальный";

const propertyTypeOptions: Array<{ value: PropertyType; label: string }> = [
  { value: "Тег", label: "Тег" },
  { value: "Глобальный", label: "Глобальный" },
  { value: "Локальный", label: "Локальный" },
];

const valueTypeOptions: Array<{ value: string; label: string }> = [
  { value: "string", label: "string" },
  { value: "integer", label: "integer" },
  { value: "float", label: "float" },
  { value: "boolean", label: "boolean" },
  { value: "date", label: "date" },
];

const ACCESS_LEVEL_MIN = 0;
const ACCESS_LEVEL_MAX = 10;

export function AddPropertyContent({ elementKey, property }: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);
  const addProperty = useEditorStore((s) => s.addProperty);
  const editProperty = useEditorStore((s) => s.editProperty);

  const [name, setName] = useState(property?.name || "");
  const [propertyType, setPropertyType] = useState<PropertyType>(
    (property?.property_type as PropertyType) || "Тег"
  );
  const [description, setDescription] = useState(property?.description || "");
  const [valueType, setValueType] = useState(property?.value_type || "");
  const [defaultValue, setDefaultValue] = useState(property?.default_value || "");
  const [logging, setLogging] = useState(property?.logging || false);
  const [onChange, setOnChange] = useState(property?.onChange || "");
  const [accessLevel, setAccessLevel] = useState(property?.access_level ?? ACCESS_LEVEL_MIN);
  const [onCanChange, setOnCanChange] = useState(property?.OnCanChange || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setName(property?.name || "");
    setPropertyType((property?.property_type as PropertyType) || "Тег");
    setDescription(property?.description || "");
    setValueType(property?.value_type || "");
    setDefaultValue(property?.default_value || "");
    setLogging(property?.logging || false);
    setOnChange(property?.onChange || "");
    setAccessLevel(property?.access_level ?? ACCESS_LEVEL_MIN);
    setOnCanChange(property?.OnCanChange || "");
  }, [property]);

  const isTagType = propertyType === "Тег";
  /**
   * Чего не хватает, чтобы свойство можно было сохранить (null — всё на месте).
   *
   * Имя и тип значения бэкенд требует обязательно («Property value_type is required
   * for '…'»), и с тех пор как свойства уезжают вместе со сценой, одно незаполненное
   * свойство роняет сохранение ВСЕЙ сцены — раньше отказ приходил на свой же запрос и
   * дальше свойства не пускал. Поэтому проверяем здесь, до создания.
   */
  const missing = useMemo(() => {
    if (!name.trim()) return "Введите название свойства";
    if (!valueType.trim()) return "Выберите тип значения";
    if (isTagType && !selectedDevice && !property?.tag_id) return "Выберите тег в дереве устройств";
    return null;
  }, [name, valueType, isTagType, selectedDevice, property?.tag_id]);

  const canConfirm = !isLoading && missing === null;

  // Серверный id владельца — только чтобы положить его в payload как раньше; адресация
  // идёт по ключу. У несохранённого элемента здесь null, и это нормально: бэкенд узнаёт
  // владельца по месту свойства в дереве сцены.
  const ownerId = useEditorStore(
    s => s.elements.find(el => el.key === elementKey)?.id ?? null,
  );

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setIsLoading(true);
    try {
      const payload = {
        name: name.trim(),
        component_id: ownerId,
        property_type: propertyType,
        tag_id: isTagType ? (selectedDevice ?? property?.tag_id ?? "") : "",
        description: description.trim(),
        value_type: valueType.trim(),
        default_value: defaultValue,
        logging,
        onChange: onChange.trim(),
        access_level: accessLevel,
        OnCanChange: onCanChange.trim(),
      };

      // Правка существующего — по id, если он есть; у ещё не сохранённого свойства
      // ключом служит имя, под которым его завели.
      const ok = property
        ? await editProperty(elementKey, property, payload)
        : await addProperty(elementKey, payload);

      if (ok) closeModal();
    } catch (error) {
      console.error("Failed to add property:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!property?.id) return;

    setIsLoading(true);
    try {
      // Форму закрываем только при реальном удалении: при отказе в подтверждении или
      // конфликте версий пользователь остаётся в ней и видит те же данные.
      if (await confirmDeleteProperty(property, elementKey)) closeModal();
    } finally {
      setIsLoading(false);
    }
  };

  // Адаптивный input
  const inputClass = cn(
    "w-full rounded-xl border bg-white dark:bg-gray-900/80",
    "border-gray-300 dark:border-gray-700/80",
    "px-4 py-3.5 text-gray-900 dark:text-gray-100",
    "placeholder:text-gray-400 dark:placeholder:text-gray-600",
    "outline-hidden hover:border-gray-400 dark:hover:border-gray-600",
    "focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
    "transition-all shadow-sm"
  );

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          {property ? "Редактирование свойства" : "Добавление свойства"}
        </Dialog.Title>

        <Dialog.Description className="text-gray-500 dark:text-gray-400 text-sm">
          Выберите тип свойства и заполните данные для сохранения.
        </Dialog.Description>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-5">
        {/* Название */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
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

        {/* Тип свойства */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
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

        {/* Описание + Тип значения */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
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
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
              Тип значения
            </label>
            <Select.Root value={valueType} onValueChange={setValueType}>
              <Select.Trigger className={cn(selectTriggerClassName, inputClass)}>
                <Select.Value placeholder="Выберите тип значения" />
                <Select.Icon>
                  <ChevronDown className={selectIconClassName} />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content position="popper" sideOffset={6} className={selectContentClassName}>
                  <Select.Viewport className="p-1.5">
                    <Select.Group>
                      {valueTypeOptions.map((item) => (
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
        </div>

        {/* Значение по умолчанию + Логирование */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
              Значение по умолчанию
            </label>
            {isBooleanValueType(valueType) ? (
              <label className="flex items-center gap-3 rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-3.5 text-sm text-gray-700 dark:text-gray-200 shadow-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultValue === "true"}
                  onChange={(e) => setDefaultValue(e.target.checked ? "true" : "false")}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                />
                {defaultValue === "true" ? "true" : "false"}
              </label>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="Введите значение"
                  className={cn(inputClass, "pr-11")}
                />
                <Type className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-600 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
              Логирование
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-3.5 text-sm text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900/80 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={logging}
                onChange={(e) => setLogging(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500"
              />
              Включить логирование
            </label>
          </div>
        </div>

        {/* Уровень доступа */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
            Уровень доступа
          </label>
          <input
            type="number"
            min={ACCESS_LEVEL_MIN}
            max={ACCESS_LEVEL_MAX}
            value={accessLevel}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isNaN(value)) return;
              setAccessLevel(Math.min(ACCESS_LEVEL_MAX, Math.max(ACCESS_LEVEL_MIN, value)));
            }}
            className={inputClass}
          />
        </div>

        {/* onChange */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
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
            <TextCursorInput className="absolute right-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-600 pointer-events-none" />
          </div>
        </div>

        {/* OnCanChange */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
            OnCanChange
          </label>
          <div className="relative">
            <textarea
              value={onCanChange}
              onChange={(e) => setOnCanChange(e.target.value)}
              placeholder="Код/описание обработчика проверки возможности изменения"
              rows={5}
              className={cn(inputClass, "min-h-28 resize-y pr-11")}
            />
            <TextCursorInput className="absolute right-4 top-4 h-5 w-5 text-gray-400 dark:text-gray-600 pointer-events-none" />
          </div>
        </div>

        {/* Device Tree */}
        {isTagType ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Waypoints className="h-4 w-4 text-indigo-500" />
              Выберите тег в дереве устройств
            </div>

            <div className="h-[360px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/70">
              <DeviceTreePanel />
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-500">
              {selectedDevice
                ? `Выбран тег: ${selectedDevice}`
                : "Пока тег не выбран — кнопка сохранения будет недоступна."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-400 flex items-start gap-3">
            <List className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <span>
              Для типа <span className="font-medium text-gray-900 dark:text-gray-200">{propertyType}</span> поле{" "}
              <span className="font-medium text-gray-900 dark:text-gray-200">tag_id</span> будет пустым.
            </span>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <ModalFooter className="shrink-0 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800/80">
        {property?.id ? (
          <Button variant="danger" onClick={handleDelete} disabled={isLoading} className="mr-auto">
            <Trash2 size={16} />
            Удалить свойство
          </Button>
        ) : null}
        {missing && (
          <span className="mr-auto text-xs text-amber-600 dark:text-amber-400">{missing}</span>
        )}
        <Button onClick={closeModal}>Отмена</Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!canConfirm}
          title={missing ?? undefined}
        >
          {isLoading ? "Сохранение..." : property ? "Сохранить" : "Добавить свойство"}
        </Button>
      </ModalFooter>
    </div>
  );
}

export default function OpenAddPropertyModal(props: Props) {
  const { openModal } = useModalStore.getState();
  openModal(<AddPropertyContent {...props} />);
}