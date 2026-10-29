import {useEffect, useMemo, useState} from "react";
import {fetchAutomation} from "@/core/automation";
import {checkScriptSyntax} from "@/core/runtime";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {VARIABLE_TAG_PREFIX, type AutomationVariable} from "@/types/automation.types";
import type {PropertyCreateDto} from "@/types/tags.types";
import {useEditorStore} from "../../../model/editorStore";
import {confirmDeleteProperty} from "../../../lib/confirmDeleteProperty";
import {ACCESS_LEVEL_MIN, VARIABLE_VALUE_TYPE, variableNameOf, type PropertyType, type TagSource} from "./propertyOptions";

export interface PropertyFormProps {
  /**
   * Ключ элемента-владельца. Адресуем именно ключом, а не серверным `component_id`:
   * свойство теперь можно завести элементу, которого на сервере ещё нет (id === null),
   * и по id такой элемент не находится.
   */
  elementKey: string;
  property?: PropertyCreateDto;
  /**
   * Начальные значения НОВОГО свойства (без `property`): так перо тренда открывает форму
   * уже с именем `penN`, типом «Тег» и `float`. На режим правки не влияет.
   */
  preset?: Partial<PropertyCreateDto>;
}

/**
 * Состояние окна свойства: поля, источник тега, проверка и сохранение. Окно монтируется
 * заново при каждом открытии, поэтому начальные значения берутся один раз — из правимого
 * свойства либо заготовки.
 */
export function usePropertyForm({elementKey, property, preset}: PropertyFormProps) {
  const init = property ?? preset;
  const closeModal = useCloseModal();
  const addProperty = useEditorStore((s) => s.addProperty);
  const editProperty = useEditorStore((s) => s.editProperty);

  const [name, setName] = useState(init?.name || "");
  const [propertyType, setPropertyType] = useState<PropertyType>((init?.property_type as PropertyType) || "Тег");
  const [label, setLabel] = useState(init?.label || "");
  const [gatewayName, setGatewayName] = useState(init?.gateway_name || "");
  const [valueType, setValueType] = useState(init?.value_type || "");
  const [defaultValue, setDefaultValue] = useState(init?.default_value || "");
  const [onChange, setOnChange] = useState(init?.onChange || "");
  const [accessLevel, setAccessLevel] = useState(init?.access_level ?? ACCESS_LEVEL_MIN);
  const [onCanChange, setOnCanChange] = useState(init?.OnCanChange || "");
  const [isLoading, setIsLoading] = useState(false);

  const initialVariable = variableNameOf(init?.tag_id);
  const [tagSource, setTagSource] = useState<TagSource>(initialVariable ? "variable" : "channel");
  const [variableName, setVariableName] = useState<string | null>(initialVariable);
  // Канал выбирается в своём дереве окна: общее выделение «Базы каналов» не трогаем.
  const [channelTag, setChannelTag] = useState<string | null>(initialVariable ? null : (property?.tag_id || null));
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

  const chooseVariable = (variable: AutomationVariable) => {
    setVariableName(variable.name);
    if (!valueType) setValueType(VARIABLE_VALUE_TYPE[variable.value_type] ?? "");
  };

  const isTagType = propertyType === "Тег";
  // Путь канала из прошлого выбора не подставляем вместо переменной и наоборот.
  const chosenTagId = tagSource === "variable"
    ? (variableName ? `${VARIABLE_TAG_PREFIX}${variableName}` : "")
    : (channelTag ?? "");

  // onChange бэкенд с 25.09.2026 разбирает как JavaScript и при ошибке отклоняет всю
  // сцену. OnCanChange он не проверяет — о нём только предупреждаем, сохранять не мешаем.
  const onChangeError = useMemo(() => checkScriptSyntax(onChange), [onChange]);
  const onCanChangeError = useMemo(() => checkScriptSyntax(onCanChange), [onCanChange]);

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
    if (onChangeError) return "Исправьте синтаксическую ошибку в onChange";
    return null;
  }, [name, valueType, isTagType, chosenTagId, tagSource, onChangeError]);

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
        // Галочку убрали: архив runtime пишет все теги топиков без исключений (контракт
        // 2026-09-28-tag-archive-contract.md, раздел 6). Поле на бэкенде пока есть, а
        // свойство уезжает целиком — поэтому значение сохраняем как было.
        logging: property?.logging ?? false,
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

  return {
    name, setName, propertyType, setPropertyType, label, setLabel, gatewayName, setGatewayName,
    valueType, setValueType, defaultValue, setDefaultValue, accessLevel, setAccessLevel,
    onChange, setOnChange, onCanChange, setOnCanChange, onChangeError, onCanChangeError,
    tagSource, setTagSource, channelTag, setChannelTag, variables, variableName, chooseVariable,
    isTagType, isLoading, missing, canConfirm, handleConfirm, handleDelete, closeModal,
  };
}
