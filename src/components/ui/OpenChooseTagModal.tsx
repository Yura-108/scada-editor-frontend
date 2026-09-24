"use client";

import React, { useMemo, useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, List, TextCursorInput, Trash2, Type, Waypoints } from "lucide-react";
import DeviceTreePanel from "@/components/channels/DeviceTreePanel";
import SelectItem from "@/components/ui/SelectItem";
import { selectContentClassName, selectIconClassName, selectTriggerClassName } from "@/components/ui/selectStyles";
import { cn } from "@/lib/utils";
import {shortTagPath} from "@/lib/editor/tagPath";
import { useModalStore } from "@/store/modalStore";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useEditorStore } from "@/store/useEditorStore";
import { PropertyCreateDto } from "@/types/tags.types";
import { isBooleanValueType } from "@/lib/editor/valueTypes";
import { Button, ModalFooter } from "@/components/ui/Button";
import { confirmDeleteProperty } from "@/lib/editor/confirmDeleteProperty";
import {fetchAutomation} from "@/lib/automation/automationApi";
import {VARIABLE_TAG_PREFIX, type AutomationVariable} from "@/types/automation.types";

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

/** Откуда берётся tag_id свойства типа «Тег»: канал из дерева или переменная проекта. */
type TagSource = "channel" | "variable";

/** Типы переменной automation → типы значения свойства (у свойств словарь свой). */
const VARIABLE_VALUE_TYPE: Record<string, string> = {bool: "boolean", int: "integer", float: "float", string: "string"};

/** Имя переменной проекта из tag_id вида `@var.<имя>`; null — это не переменная. */
const variableNameOf = (tagId: string | undefined | null): string | null =>
  tagId?.startsWith(VARIABLE_TAG_PREFIX) ? tagId.slice(VARIABLE_TAG_PREFIX.length) : null;

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
  const [label, setLabel] = useState(property?.label || "");
  const [gatewayName, setGatewayName] = useState(property?.gateway_name || "");
  const [valueType, setValueType] = useState(property?.value_type || "");
  const [defaultValue, setDefaultValue] = useState(property?.default_value || "");
  const [logging, setLogging] = useState(property?.logging || false);
  const [onChange, setOnChange] = useState(property?.onChange || "");
  const [accessLevel, setAccessLevel] = useState(property?.access_level ?? ACCESS_LEVEL_MIN);
  const [onCanChange, setOnCanChange] = useState(property?.OnCanChange || "");
  const [isLoading, setIsLoading] = useState(false);

  const initialVariable = variableNameOf(property?.tag_id);
  const [tagSource, setTagSource] = useState<TagSource>(initialVariable ? "variable" : "channel");
  const [variableName, setVariableName] = useState<string | null>(initialVariable);
  const [variables, setVariables] = useState<AutomationVariable[] | null>(null);
  const currentProjectId = useEditorStore((s) => s.currentProject?.id ?? null);

  // Список переменных грузим, только когда пользователь выбрал этот источник.
  useEffect(() => {
    if (tagSource !== "variable" || variables !== null) return;
    if (currentProjectId == null) { setVariables([]); return; }
    fetchAutomation(currentProjectId)
      .then(set => setVariables(set.variables ?? []))
      .catch(() => setVariables([]));
  }, [tagSource, variables, currentProjectId]);

  useEffect(() => {
    setName(property?.name || "");
    setPropertyType((property?.property_type as PropertyType) || "Тег");
    setLabel(property?.label || "");
    setGatewayName(property?.gateway_name || "");
    setValueType(property?.value_type || "");
    setDefaultValue(property?.default_value || "");
    setLogging(property?.logging || false);
    setOnChange(property?.onChange || "");
    setAccessLevel(property?.access_level ?? ACCESS_LEVEL_MIN);
    setOnCanChange(property?.OnCanChange || "");
    const variable = variableNameOf(property?.tag_id);
    setTagSource(variable ? "variable" : "channel");
    setVariableName(variable);
  }, [property]);

  const isTagType = propertyType === "Тег";
  // Путь канала из прошлого выбора не подставляем вместо переменной и наоборот.
  const chosenTagId = tagSource === "variable"
    ? (variableName ? `${VARIABLE_TAG_PREFIX}${variableName}` : "")
    : (selectedDevice ?? (initialVariable ? "" : property?.tag_id) ?? "");
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
    if (isTagType && !chosenTagId) {
      return tagSource === "variable" ? "Выберите переменную проекта" : "Выберите тег в дереве устройств";
    }
    return null;
  }, [name, valueType, isTagType, chosenTagId, tagSource]);

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
        tag_id: isTagType ? chosenTagId : "",
        label: label.trim() || null,
        gateway_name: gatewayName.trim() || null,
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

        {/* Имя — для оператора; «Название» занято скриптами */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
            Имя
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Как свойство видит оператор"
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

        {/* Имя для шлюза + Тип значения */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
              Имя для шлюза
            </label>
            <input
              type="text"
              value={gatewayName}
              onChange={(e) => setGatewayName(e.target.value)}
              placeholder="OBJECT10.S_PAR_F[ 4 ]"
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
            <div className="flex gap-2">
              {(["channel", "variable"] as TagSource[]).map(source => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setTagSource(source)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm",
                    tagSource === source
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                  )}
                >
                  {source === "channel" ? "Канал" : "Переменная проекта"}
                </button>
              ))}
            </div>

            {tagSource === "channel" ? (
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Waypoints className="h-4 w-4 text-indigo-500" />
                  Выберите тег в дереве устройств
                </div>

                <div className="h-[360px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/70">
                  <DeviceTreePanel />
                </div>

                {/* Полный путь оставляем в `title`: подпись короткая, но проверить,
                    тот ли это узел дерева, по-прежнему можно наведением. */}
                <p className="text-xs text-gray-500 dark:text-gray-500" title={selectedDevice ?? undefined}>
                  {selectedDevice
                    ? `Выбран тег: ${shortTagPath(selectedDevice)}`
                    : "Пока тег не выбран — кнопка сохранения будет недоступна."}
                </p>
              </>
            ) : (
              <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800 p-2 space-y-1">
                {variables === null && <p className="text-sm text-gray-500 px-2 py-1">Загрузка…</p>}
                {variables?.length === 0 && (
                  <p className="text-sm text-gray-500 px-2 py-1">
                    У проекта нет переменных — заведите их на странице «Автоматизация».
                  </p>
                )}
                {variables?.map(v => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => {
                      setVariableName(v.name);
                      if (!valueType) setValueType(VARIABLE_VALUE_TYPE[v.value_type] ?? "");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm",
                      variableName === v.name
                        ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800",
                    )}
                  >
                    <span className="font-mono">{VARIABLE_TAG_PREFIX}{v.name}</span>
                    <span className="ml-2 text-xs text-gray-500">{v.value_type}{v.description ? ` · ${v.description}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
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