import React from "react";
import {ExternalLink, Terminal} from "lucide-react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {cn} from "@/shared/lib/cn";
import {TitleWithHint} from "@/shared/ui/codeModalParts";
import {DiagramElement} from "@/types/editorElement.type";
import {ElementEventName} from "@/types/binding.types";
import {ChooseObjectPropertyModal} from "../bindings/OpenChooseObjectPropertyModal";
import {useEventScriptEditor} from "./useEventScriptEditor";
import {ScriptCodeField} from "../script/ScriptCodeField";
import {ScriptTestRun} from "../script/ScriptTestRun";
import {PropertyRefChips, TagChips} from "../script/ScopeChips";
import {chipClasses} from "../script/scriptStyles";

const EVENT_LABEL: Record<ElementEventName, string> = {
  onClick: "onClick (клик)",
  onDoubleClick: "onDoubleClick (двойной клик)",
};

interface EventScriptProps {
  element: DiagramElement;
  event: ElementEventName;
}

function EventScriptModalContent({element, event}: EventScriptProps) {
  const {
    scope, propertyRefs, code, setCode, viewRef, insertAtCursor, pickerOpen, setPickerOpen,
    addPropertyRef, removePropertyRef, mockValues, setMockValues, syntaxError, otherScenes,
    setPropertyCall, runTest, outcome, handleSave, closeModal,
  } = useEventScriptEditor(element, event);

  return (
    <div className="flex flex-col h-full gap-4">
      <TitleWithHint
        title={<>Событие {EVENT_LABEL[event]}</>}
        description={
          <>
            JavaScript исполняется в мониторе по событию. Чтение: <code>Имя</code> — переменная это
            само значение тега/свойства (исходная строка — <code>RAW.Имя</code>).
            Запись свойства объекта: <code>setProperty(&quot;Имя&quot;, значение)</code> — на неё
            реагируют привязки других элементов. Серверный скрипт (запись тега в ПЛК):{" "}
            <code>runScript(&quot;Имя&quot;)</code>, с аргументами —{" "}
            <code>runScript(&quot;Имя&quot;, {"{"} recipe: 4 {"}"})</code> (в серверном скрипте это объект{" "}
            <code>args</code>). Меню выбора у точки клика:{" "}
            <code>showMenu([{"{"} label, script, args {"}"}])</code> — выбранный пункт запустит{" "}
            <code>script</code> с его <code>args</code>. Открыть другую схему проекта:{" "}
            <code>openScene(&quot;Имя схемы&quot;)</code> или <code>openScene(id)</code>.
            Также доступны <code>setProp</code>, <code>setState</code>, <code>self</code>.
          </>
        }
      />

      {/* Теги / свойства / выбор свойства */}
      <div className="shrink-0 space-y-2">
        <TagChips scope={scope} onInsert={insertAtCursor} />

        <PropertyRefChips
          refs={propertyRefs}
          titleOf={ref => `${ref.componentLabel} · ${ref.propertyName} — клик вставит setProperty`}
          onInsert={ref => insertAtCursor(setPropertyCall(ref.varName))}
          onRemove={removePropertyRef}
          onPick={() => setPickerOpen(true)}
        />

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

        {/* Схемы проекта — клик вставит openScene(id). Id, а не имя: он переживает
            переименование схемы. Имя — блочным комментарием, чтобы код остался читаемым и
            вставка посреди строки не закомментировала её хвост. */}
        {otherScenes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Схемы:</span>
            {otherScenes.map(scene => (
              <span
                key={scene.id}
                className={cn(chipClasses, "bg-sky-950/60 text-sky-300 border-sky-800/40 hover:bg-sky-900/70")}
                title={`Схема «${scene.name}» — клик вставит openScene`}
                onClick={() => insertAtCursor(`openScene(${scene.id} /* ${scene.name.replace(/\*\//g, "* /")} */)`)}
              >
                <ExternalLink size={12} />
                {scene.name}
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

      <ScriptCodeField code={code} setCode={setCode} viewRef={viewRef} />

      {scope.names.length > 0 && (
        <ScriptTestRun
          names={scope.names}
          mockValues={mockValues}
          setMockValues={setMockValues}
          onRun={runTest}
          outcome={outcome}
        />
      )}

      {syntaxError && (
        <div role="alert" className="shrink-0 text-sm text-red-600 dark:text-red-400">
          Синтаксическая ошибка: {syntaxError}
        </div>
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
          disabled={!code.trim() || Boolean(syntaxError)}
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
  openModal(<EventScriptModalContent {...props} />, {size: "fullscreen", legacyLayout: true});
}
