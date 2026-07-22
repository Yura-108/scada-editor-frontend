import React, {useMemo, useRef, useState} from "react";
import CodeMirror, {EditorView} from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {Boxes, Play, Tag, Terminal, Wand2, X} from "lucide-react";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {cn} from "@/lib/utils";
import {formatCode} from "@/lib/formatCode";
import {Collapsible, TitleWithHint} from "@/components/ui/codeModalParts";
import {DiagramElement} from "@/types/editorElement.type";
import {
  ElementEventHandler,
  ElementEventName,
  ElementEvents,
  PropertyRef,
} from "@/types/binding.types";
import {collectTagScope, uniqueVarName, withPropertyRefs} from "@/lib/runtime/bindingScope";
import {compileEventScript, executeEventScript} from "@/lib/runtime/eventScript";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {ChooseObjectPropertyModal, type PickedProperty} from "../bindings/OpenChooseObjectPropertyModal";

const EVENT_LABEL: Record<ElementEventName, string> = {
  onClick: "onClick (клик)",
  onDoubleClick: "onDoubleClick (двойной клик)",
};

interface EventScriptProps {
  element: DiagramElement;
  event: ElementEventName;
}

type TestResult =
  | {kind: "ok"; text: string}
  | {kind: "error"; message: string}
  | null;

function EventScriptModalContent({element, event}: EventScriptProps) {
  const closeModal = useModalStore(s => s.closeModal);
  const existing = element.events?.[event];

  const [propertyRefs, setPropertyRefs] = useState<PropertyRef[]>(existing?.propertyRefs ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [code, setCode] = useState(existing?.code ?? "");
  const [mockValues, setMockValues] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<TestResult>(null);

  const scope = useMemo(
    () => withPropertyRefs(collectTagScope(element.properties), propertyRefs),
    [element.properties, propertyRefs],
  );

  const viewRef = useRef<EditorView | null>(null);

  const insertAtCursor = (text: string) => {
    const view = viewRef.current;
    if (!view) {
      setCode(c => c + text);
      return;
    }
    const {from, to} = view.state.selection.main;
    view.dispatch({changes: {from, to, insert: text}, selection: {anchor: from + text.length}});
    view.focus();
  };

  const addPropertyRef = (picked: PickedProperty) => {
    setPickerOpen(false);
    const found = propertyRefs.find(r => r.propertyId === picked.propertyId);
    if (found) {
      insertAtCursor(`setProperty("${found.varName}", ${found.varName}.V + 1)`);
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
    insertAtCursor(`setProperty("${varName}", ${varName}.V + 1)`);
  };

  const removePropertyRef = (propertyId: number) =>
    setPropertyRefs(prev => prev.filter(r => r.propertyId !== propertyId));

  const runTest = () => {
    const handler: ElementEventHandler = {code, propertyRefs, enabled: true};
    const compiled = compileEventScript(element.key, handler, scope);
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
    const res = executeEventScript(compiled, valuesByTagId, valuesByPropertyId, getRenderedElement(element));
    if ("error" in res) {
      setTestResult({kind: "error", message: `Ошибка исполнения: ${res.error}`});
      return;
    }
    const parts = [
      ...res.writes.map(w => `setProperty(#${w.propertyId}) ← ${JSON.stringify(w.value)}`),
      ...res.intents.map(i =>
        i.kind === "state" ? `setState("${i.stateName}")` : `setProp("${i.key}", ${JSON.stringify(i.value)})`,
      ),
    ];
    setTestResult({kind: "ok", text: parts.length ? parts.join("\n") : "Код выполнен, действий нет"});
  };

  const handleSave = () => {
    if (!code.trim()) return;
    const nextHandler: ElementEventHandler = {
      code,
      enabled: existing?.enabled ?? true,
      propertyRefs,
    };
    const nextEvents: ElementEvents = {...(element.events ?? {}), [event]: nextHandler};
    useEditorStore.getState().updateElement(element.key, {events: nextEvents});
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
        title={<>Событие {EVENT_LABEL[event]}</>}
        description={
          <>
            JavaScript исполняется в мониторе по событию. Чтение: <code>Имя.V</code> (тег/свойство).
            Запись свойства объекта: <code>setProperty(&quot;Имя&quot;, значение)</code> — на неё
            реагируют привязки других элементов. Серверный скрипт (запись тега в ПЛК):{" "}
            <code>runScript(&quot;Имя&quot;)</code>. Также доступны <code>setProp</code>,{" "}
            <code>setState</code>, <code>self</code>.
          </>
        }
      />

      {/* Теги / свойства / выбор свойства */}
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Свойства:</span>
          {propertyRefs.map(ref => (
            <span
              key={ref.propertyId}
              className={cn(chipClasses, "bg-emerald-950/60 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/70")}
              title={`${ref.componentLabel} · ${ref.propertyName} — клик вставит setProperty`}
              onClick={() => insertAtCursor(`setProperty("${ref.varName}", ${ref.varName}.V + 1)`)}
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

        {/* Серверные скрипты компонента — клик вставит runScript("Имя") */}
        {element.scripts && element.scripts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Скрипты:</span>
            {element.scripts.map(script => (
              <span
                key={script.id}
                className={cn(chipClasses, "bg-amber-950/60 text-amber-300 border-amber-800/40 hover:bg-amber-900/70")}
                title={`Серверный скрипт «${script.name}» — клик вставит runScript`}
                onClick={() => insertAtCursor(`runScript("${script.name}")`)}
              >
                <Terminal size={12} />
                {script.name}
              </span>
            ))}
          </div>
        )}

        {scope.invalidNames.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            Имена {scope.invalidNames.map(n => `«${n}»`).join(", ")} нельзя использовать
            в коде (невалидный идентификатор или конфликт).
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
            onCreateEditor={view => {
              viewRef.current = view;
            }}
            theme="dark"
          />
        </div>
      </div>

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
            {scope.names.map(varName => (
              <div key={varName} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono shrink-0">{varName} =</span>
                <input
                  type="text"
                  className={cn(inputClasses, "px-2 py-1 text-xs rounded-lg")}
                  placeholder="значение"
                  value={mockValues[varName] ?? ""}
                  onChange={e => setMockValues(v => ({...v, [varName]: e.target.value}))}
                />
              </div>
            ))}
          </div>
          {testResult && (
            <div
              className={cn(
                "text-xs rounded-lg px-3 py-2 font-mono whitespace-pre-wrap",
                testResult.kind === "error" ? "bg-red-950/40 text-red-300" : "bg-emerald-950/40 text-emerald-300",
              )}
            >
              {testResult.kind === "error" ? testResult.message : testResult.text}
            </div>
          )}
        </Collapsible>
      )}

      <div className="shrink-0 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 transition-colors text-gray-800 dark:text-gray-300"
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={!code.trim()}
          className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-700 dark:disabled:to-gray-700 disabled:text-gray-500 text-white shadow-lg shadow-indigo-900/30 transition-all disabled:shadow-none"
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

export function openEventScriptModal(props: EventScriptProps) {
  const {openModal} = useModalStore.getState();
  openModal(<EventScriptModalContent {...props} />, {variant: "fullscreen"});
}
