import {useMemo, useRef, useState} from "react";
import type {EditorView} from "@uiw/react-codemirror";
import {checkScriptSyntax, collectTagScope, uniqueVarName, withPropertyRefs} from "@/core/runtime";
import type {DiagramElement} from "@/types/editorElement.type";
import type {PropertyRef} from "@/types/binding.types";
import type {PickedProperty} from "../bindings/OpenChooseObjectPropertyModal";

/**
 * Общее состояние редактора скрипта (привязка, событие): ссылки на свойства других
 * компонентов и скоуп, код со вставкой в позицию курсора, значения тест-прогона и
 * синтаксическая ошибка.
 */
export function useScriptDraft({properties, initialRefs, initialCode, insertForRef}: {
  properties: DiagramElement["properties"];
  initialRefs?: PropertyRef[];
  /** Код при открытии окна; получает имена скоупа с учётом `initialRefs`. */
  initialCode: (scopeNames: string[]) => string;
  /** Что вставить в код, когда выбрали свойство — новое или уже добавленное. */
  insertForRef: (varName: string) => string;
}) {
  const [propertyRefs, setPropertyRefs] = useState<PropertyRef[]>(initialRefs ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Скоуп = свойства-теги элемента + ссылки на свойства других компонентов.
  const scope = useMemo(
    () => withPropertyRefs(collectTagScope(properties), propertyRefs),
    [properties, propertyRefs],
  );
  // Скоуп для начального кода собираем прямо здесь: инициализатор useState выполняется
  // один раз, и ему нужны имена на момент открытия.
  const [code, setCode] = useState(() =>
    initialCode(withPropertyRefs(collectTagScope(properties), initialRefs).names),
  );
  const [mockValues, setMockValues] = useState<Record<string, string>>({});

  const viewRef = useRef<EditorView | null>(null);

  const insertAtCursor = (text: string) => {
    const view = viewRef.current;
    if (!view) {
      setCode(c => c + text);
      return;
    }
    const {from, to} = view.state.selection.main;
    view.dispatch({
      changes: {from, to, insert: text},
      selection: {anchor: from + text.length},
    });
    view.focus();
  };

  const addPropertyRef = (picked: PickedProperty) => {
    setPickerOpen(false);
    const existing = propertyRefs.find(r => r.propertyId === picked.propertyId);
    if (existing) {
      // Свойство уже добавлено — только вставляем его в код.
      insertAtCursor(insertForRef(existing.varName));
      return;
    }
    const taken = new Set<string>([...scope.names, ...propertyRefs.map(r => r.varName)]);
    const varName = uniqueVarName(picked.propertyName, taken);
    setPropertyRefs(prev => [
      ...prev,
      {
        varName,
        propertyId: picked.propertyId,
        componentKey: picked.componentKey,
        componentId: picked.componentId,
        componentLabel: picked.componentLabel,
        propertyName: picked.propertyName,
        valueType: picked.valueType,
      },
    ]);
    insertAtCursor(insertForRef(varName));
  };

  const removePropertyRef = (propertyId: number) =>
    setPropertyRefs(prev => prev.filter(r => r.propertyId !== propertyId));

  /** Значения тест-прогона по адресам: тег — по tag_id, свойство — по propertyId. Пустые пропускаются. */
  const mockMaps = () => {
    const valuesByTagId = new Map<string, string>();
    const valuesByPropertyId = new Map<number, string>();
    for (const varName of scope.names) {
      const raw = mockValues[varName];
      if (raw === undefined || raw === "") continue;
      if (varName in scope.tagIdByName) valuesByTagId.set(scope.tagIdByName[varName], raw);
      else valuesByPropertyId.set(scope.propertyIdByName[varName], raw);
    }
    return {valuesByTagId, valuesByPropertyId};
  };

  // Бэкенд отклонит всю сцену со скриптом, который не разбирается (контракт 25.09.2026):
  // показываем ошибку сразу и не даём сохранить — см. checkScriptSyntax.
  const syntaxError = useMemo(() => checkScriptSyntax(code), [code]);

  return {
    propertyRefs, scope, code, setCode, viewRef, insertAtCursor,
    pickerOpen, setPickerOpen, addPropertyRef, removePropertyRef,
    mockValues, setMockValues, mockMaps, syntaxError,
  };
}
