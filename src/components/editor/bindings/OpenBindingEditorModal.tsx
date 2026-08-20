import React, {useMemo, useRef, useState} from "react";
import CodeMirror, {EditorView} from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {Boxes, Play, Tag, Wand2, X} from "lucide-react";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {cn} from "@/lib/utils";
import {formatCode} from "@/lib/formatCode";
import {Collapsible, TitleWithHint} from "@/components/ui/codeModalParts";
import {createUuid} from "@/lib/createUuid";
import {DiagramElement} from "@/types/editorElement.type";
import {PropertyRef, TagBinding} from "@/types/binding.types";
import {
  collectTagScope,
  hasSavedProperty,
  hasSavedTagProperty,
  uniqueVarName,
  withPropertyRefs,
} from "@/lib/runtime/bindingScope";
import {compileBinding, executeBinding, type BindingIntent} from "@/lib/runtime/executeBinding";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {ChooseObjectPropertyModal, type PickedProperty} from "./OpenChooseObjectPropertyModal";

interface BindingEditorProps {
  element: DiagramElement;
  /** Существующий биндинг для редактирования; не задан — создание нового. */
  binding?: TagBinding;
}

const buildTemplate = (tagName: string | undefined, stateNames: string[]) => {
  const name = tagName ?? "ИМЯ_ТЕГА";
  const alarm = stateNames.find(s => s !== "Нормальное") ?? "Авария";
  const normal = stateNames.includes("Нормальное") ? "Нормальное" : (stateNames[0] ?? "Нормальное");
  return `if (${name}.V > 100) {\n  setState("${alarm}")\n} else {\n  setState("${normal}")\n}\n`;
};

type TestResult =
  | {kind: "ok"; intents: BindingIntent[]}
  | {kind: "error"; message: string}
  | null;

function BindingEditorModalContent({element, binding}: BindingEditorProps) {
  const closeModal = useModalStore(s => s.closeModal);

  const [name, setName] = useState(binding?.name ?? "");
  const [propertyRefs, setPropertyRefs] = useState<PropertyRef[]>(binding?.propertyRefs ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const stateNames = useMemo(() => element.states.map(s => s.name), [element.states]);
  // Скоуп = свойства-теги элемента + ссылки на свойства других компонентов.
  const scope = useMemo(
    () => withPropertyRefs(collectTagScope(element.properties), propertyRefs),
    [element.properties, propertyRefs],
  );
  // Бэкенд требует ссылку на СВОЁ сохранённое свойство при сохранении сцены (иначе
  // POST всей сцены падает 400). Для биндинга-тега — свойство-тег; для биндинга на
  // чужие свойства годится любое сохранённое свойство хоста (см. hasSavedProperty).
  const canSave = useMemo(
    () =>
      hasSavedTagProperty(element.properties) ||
      (propertyRefs.length > 0 && hasSavedProperty(element.properties)),
    [element.properties, propertyRefs.length],
  );

  const [code, setCode] = useState(
    binding?.code ?? buildTemplate(scope.names[0], stateNames),
  );
  const [mockValues, setMockValues] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<TestResult>(null);

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
      // Свойство уже добавлено — просто вставим его переменную в код.
      insertAtCursor(`${existing.varName}.V`);
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
    insertAtCursor(`${varName}.V`);
  };

  const removePropertyRef = (propertyId: number) =>
    setPropertyRefs(prev => prev.filter(r => r.propertyId !== propertyId));

  const runTest = () => {
    const draft: TagBinding = {
      v: 1,
      id: binding?.id ?? "test",
      name: name || "тест",
      enabled: true,
      code,
      propertyRefs,
    };
    const compiled = compileBinding(element.key, draft, scope);
    if ("error" in compiled) {
      setTestResult({kind: "error", message: `Ошибка компиляции: ${compiled.error}`});
      return;
    }
    const valuesByTagId = new Map<string, string>();
    const valuesByPropertyId = new Map<number, string>();
    for (const varName of scope.names) {
      const raw = mockValues[varName];
      if (raw === undefined || raw === "") continue;
      if (varName in scope.tagIdByName) valuesByTagId.set(scope.tagIdByName[varName], raw);
      else valuesByPropertyId.set(scope.propertyIdByName[varName], raw);
    }
    const res = executeBinding(compiled, valuesByTagId, valuesByPropertyId, getRenderedElement(element));
    if ("error" in res) {
      setTestResult({kind: "error", message: `Ошибка исполнения: ${res.error}`});
    } else {
      setTestResult({kind: "ok", intents: res.intents});
    }
  };

  const handleSave = () => {
    if (!name.trim() || !code.trim() || !canSave) return;
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

  const inputClasses = cn(
    "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-2.5",
    "text-gray-900 dark:text-gray-100 placeholder:text-gray-500 outline-none",
    "hover:border-gray-400 dark:hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
    "transition-all shadow-sm",
  );

  const chipClasses = cn(
    "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer",
    "bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 hover:bg-indigo-900/70 transition-colors",
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <TitleWithHint
        title={binding ? "Редактирование привязки" : "Новая привязка"}
        description={
          <>
            JavaScript-код исполняется в мониторе при изменении тегов и свойств. В скоупе — свойства-теги
            элемента и свойства других компонентов сцены (объект <code>{"{V, RAW}"}</code>) и API:{" "}
            <code>setState(&quot;Имя&quot;)</code>, <code>setProp(&quot;color&quot;, значение)</code>,{" "}
            <code>self</code>.
          </>
        }
      />

      <div className="shrink-0">
        <label className="block text-xs font-medium text-gray-500 mb-1 ml-1 uppercase tracking-wider">
          Название привязки
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Например, Авария по уровню"
          className={inputClasses}
        />
      </div>

      {/* Жёсткий блок: без своего сохранённого свойства бэкенд не даст сохранить
          сцену вообще (component_property_id обязан ссылаться на свойство этого
          компонента; падает 400 на ВЕСЬ POST) — это обязательное условие для Save. */}
      {!canSave && (
        <div className="shrink-0 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-400">
          У элемента нет ни одного сохранённого свойства — бэкенд не позволит сохранить сцену
          с такой привязкой (весь сейв целиком откатится с ошибкой). Сначала добавьте элементу
          свойство на вкладке «Свойства» (оно уходит на сервер сразу же), затем возвращайтесь
          сюда — привязка сохранится.
        </div>
      )}

      {/* Доступные теги, свойства объектов и состояния — клик вставляет в код */}
      <div className="shrink-0 space-y-2">
        {scope.names.some(n => n in scope.tagIdByName) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Теги:</span>
            {scope.names
              .filter(n => n in scope.tagIdByName)
              .map(tagName => (
                <span
                  key={tagName}
                  className={chipClasses}
                  title={scope.tagIdByName[tagName]}
                  onClick={() => insertAtCursor(`${tagName}.V`)}
                >
                  <Tag size={12} />
                  {tagName}
                </span>
              ))}
          </div>
        )}

        {/* Свойства других компонентов сцены */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Свойства:</span>
          {propertyRefs.map(ref => (
            <span
              key={ref.propertyId}
              className={cn(chipClasses, "bg-emerald-950/60 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/70")}
              title={`${ref.componentLabel} · ${ref.propertyName}${ref.valueType ? " · " + ref.valueType : ""}`}
              onClick={() => insertAtCursor(`${ref.varName}.V`)}
            >
              <Boxes size={12} />
              {ref.varName}
              <X
                size={11}
                className="ml-0.5 hover:text-red-300"
                onClick={e => {
                  e.stopPropagation();
                  removePropertyRef(ref.propertyId);
                }}
              />
            </span>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-dashed border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/40 transition-colors"
          >
            <Boxes size={12} />
            Выбрать свойства объекта
          </button>
        </div>

        {scope.invalidNames.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            Имена {scope.invalidNames.map(n => `«${n}»`).join(", ")} нельзя использовать
            в коде (не являются JS-идентификаторами или конфликтуют) — переименуйте свойство.
          </div>
        )}
        {stateNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Состояния:</span>
            {stateNames.map(stateName => (
              <span
                key={stateName}
                className={cn(chipClasses, "bg-blue-950/60 text-blue-300 border-blue-800/40 hover:bg-blue-900/70")}
                onClick={() => insertAtCursor(`setState("${stateName}")`)}
              >
                {stateName}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1 ml-1">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
            Код (JavaScript)
          </label>
          <button
            type="button"
            onClick={() => setCode(c => formatCode(c))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            title="Автоматически расставить отступы"
          >
            <Wand2 size={13} />
            Форматировать
          </button>
        </div>
        <div className="flex-1 min-h-0 border border-gray-300 dark:border-gray-700/80 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/70">
          <CodeMirror
            value={code}
            height="100%"
            className="h-full text-sm"
            extensions={[javascript()]}
            onChange={value => setCode(value)}
            onCreateEditor={view => { viewRef.current = view; }}
            theme="dark"
          />
        </div>
      </div>

      {/* Тест-прогон с мок-значениями */}
      {scope.names.length > 0 && (
        <Collapsible title="Тест-прогон">
          <div className="flex justify-end">
            <button
              onClick={runTest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 hover:bg-emerald-600 text-white transition-colors"
            >
              <Play size={12} />
              Выполнить
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {scope.names.map(tagName => (
              <div key={tagName} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono shrink-0">{tagName} =</span>
                <input
                  type="text"
                  className={cn(inputClasses, "px-2 py-1 text-xs rounded-lg")}
                  placeholder="значение"
                  value={mockValues[tagName] ?? ""}
                  onChange={e => setMockValues(v => ({...v, [tagName]: e.target.value}))}
                />
              </div>
            ))}
          </div>
          {testResult && (
            <div
              className={cn(
                "text-xs rounded-lg px-3 py-2 font-mono whitespace-pre-wrap",
                testResult.kind === "error"
                  ? "bg-red-950/40 text-red-300"
                  : "bg-emerald-950/40 text-emerald-300",
              )}
            >
              {testResult.kind === "error"
                ? testResult.message
                : testResult.intents.length
                  ? testResult.intents
                      .map(i => i.kind === "state"
                        ? `setState("${i.stateName}")`
                        : `setProp("${i.key}", ${JSON.stringify(i.value)})`)
                      .join("\n")
                  : "Код выполнен, интентов нет (ни setState, ни setProp не вызваны)"}
            </div>
          )}
        </Collapsible>
      )}

      <div className="shrink-0 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600
          transition-colors text-gray-800 dark:text-gray-300"
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !code.trim() || !canSave}
          title={!canSave ? "У элемента нет сохранённого свойства — см. предупреждение выше" : undefined}
          className="px-6 py-2.5 rounded-lg font-medium
          bg-linear-to-r from-indigo-600 to-blue-600
          hover:from-indigo-500 hover:to-blue-500
          disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-700 dark:disabled:to-gray-700 disabled:text-gray-500
          text-white shadow-lg shadow-indigo-900/30 transition-all disabled:shadow-none"
        >
          Сохранить
        </button>
      </div>

      <ChooseObjectPropertyModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addPropertyRef}
        pickedIds={new Set(propertyRefs.map(r => r.propertyId))}
      />
    </div>
  );
}

export function openBindingEditorModal(props: BindingEditorProps) {
  const {openModal} = useModalStore.getState();
  openModal(<BindingEditorModalContent {...props} />, {variant: "fullscreen"});
}
