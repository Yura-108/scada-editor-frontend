import {useMemo, useState} from "react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {createUuid} from "@/shared/lib/createUuid";
import {compileBinding, executeBinding, modernizeScopeCode, type BindingIntent} from "@/core/runtime";
import {getRenderedElement} from "@/core/scene";
import type {DiagramElement} from "@/types/editorElement.type";
import type {TagBinding} from "@/types/binding.types";
import {useEditorStore} from "../../../model/editorStore";
import {useScriptDraft} from "../script/useScriptDraft";
import type {ScriptTestOutcome} from "../script/ScriptTestRun";

const buildTemplate = (tagName: string | undefined, stateNames: string[]) => {
  const name = tagName ?? "ИМЯ_ТЕГА";
  const alarm = stateNames.find(s => s !== "Нормальное") ?? "Авария";
  const normal = stateNames.includes("Нормальное") ? "Нормальное" : (stateNames[0] ?? "Нормальное");
  return `if (${name} > 100) {\n  setState("${alarm}")\n} else {\n  setState("${normal}")\n}\n`;
};

type TestResult =
  | {kind: "ok"; intents: BindingIntent[]}
  | {kind: "error"; message: string}
  | null;

const describeIntents = (intents: BindingIntent[]) =>
  intents.length
    ? intents
        .map(i => i.kind === "state"
          ? `setState("${i.stateName}")`
          : `setProp("${i.key}", ${JSON.stringify(i.value)})`)
        .join("\n")
    : "Код выполнен, интентов нет (ни setState, ни setProp не вызваны)";

/** Состояние окна привязки: название, код, ссылки на свойства, тест-прогон, сохранение. */
export function useBindingEditor(element: DiagramElement, binding: TagBinding | undefined) {
  const closeModal = useModalStore(s => s.closeModal);

  const [name, setName] = useState(binding?.name ?? "");
  const stateNames = useMemo(() => element.states.map(s => s.name), [element.states]);

  // Код старых схем показываем уже в новом синтаксисе («Имя.V» → «Имя»): рантайм всё равно
  // переводит его при компиляции, и пусть человек видит ровно то, что исполнится, — а при
  // сохранении привязки перевод осядет на сервере, и переводить будет уже нечего.
  const draft = useScriptDraft({
    properties: element.properties,
    initialRefs: binding?.propertyRefs,
    initialCode: names =>
      binding?.code != null ? modernizeScopeCode(binding.code, names) : buildTemplate(names[0], stateNames),
    insertForRef: varName => varName,
  });
  const {code, propertyRefs, scope, syntaxError} = draft;

  // Биндингу нужно свойство-хозяин: для биндинга-тега — свойство типа «Тег», для
  // биндинга на чужие свойства годится любое. Сохранённость больше не при чём —
  // свойство уезжает той же сценой, и бэкенд привязывает биндинг по имени.
  const canSave = useMemo(
    () =>
      (element.properties ?? []).some(p => p.property_type === "Тег") ||
      (propertyRefs.length > 0 && (element.properties?.length ?? 0) > 0),
    [element.properties, propertyRefs.length],
  );

  const [testResult, setTestResult] = useState<TestResult>(null);

  const runTest = () => {
    const testDraft: TagBinding = {
      v: 1,
      id: binding?.id ?? "test",
      name: name || "тест",
      enabled: true,
      code,
      propertyRefs,
    };
    const compiled = compileBinding(element.key, testDraft, scope);
    if ("error" in compiled) {
      setTestResult({kind: "error", message: `Ошибка компиляции: ${compiled.error}`});
      return;
    }
    const {valuesByTagId, valuesByPropertyId} = draft.mockMaps();
    const res = executeBinding(compiled, valuesByTagId, valuesByPropertyId, getRenderedElement(element));
    if ("error" in res) {
      setTestResult({kind: "error", message: `Ошибка исполнения: ${res.error}`});
    } else {
      setTestResult({kind: "ok", intents: res.intents});
    }
  };

  const outcome: ScriptTestOutcome = testResult && (testResult.kind === "error"
    ? {kind: "error", text: testResult.message}
    : {kind: "ok", text: describeIntents(testResult.intents)});

  const handleSave = () => {
    if (!name.trim() || !code.trim() || !canSave || syntaxError) return;
    const store = useEditorStore.getState();
    if (binding) {
      store.updateBinding(element.key, binding.id, {name: name.trim(), code, propertyRefs});
    } else {
      store.addBinding(element.key, {
        v: 1,
        id: createUuid(),
        name: name.trim(),
        enabled: true,
        code,
        propertyRefs,
      });
    }
    closeModal();
  };

  return {...draft, name, setName, stateNames, canSave, runTest, outcome, handleSave, closeModal};
}
