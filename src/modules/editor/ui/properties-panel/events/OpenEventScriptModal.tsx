import React from "react";
import {ExternalLink, Terminal} from "lucide-react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
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
    <>
      <DialogHeader
        hint
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

      <DialogBody className="flex flex-col gap-4">
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

      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={handleSave} disabled={!code.trim() || Boolean(syntaxError)}>
          Сохранить
        </Button>
      </DialogFooter>

      <ChooseObjectPropertyModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addPropertyRef}
        pickedIds={new Set(propertyRefs.map(r => r.propertyId))}
      />
    </>
  );
}

export function openEventScriptModal(props: EventScriptProps) {
  const {openModal} = useModalStore.getState();
  openModal(<EventScriptModalContent {...props} />, {size: "fullscreen"});
}
