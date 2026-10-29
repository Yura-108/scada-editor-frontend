import React from "react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {DiagramElement} from "@/types/editorElement.type";
import {TagBinding} from "@/types/binding.types";
import {ChooseObjectPropertyModal} from "./OpenChooseObjectPropertyModal";
import {useBindingEditor} from "./useBindingEditor";
import {ScriptCodeField} from "../script/ScriptCodeField";
import {ScriptTestRun} from "../script/ScriptTestRun";
import {PropertyRefChips, TagChips} from "../script/ScopeChips";
import {chipClasses, scriptInputClasses} from "../script/scriptStyles";

interface BindingEditorProps {
  element: DiagramElement;
  /** Существующий биндинг для редактирования; не задан — создание нового. */
  binding?: TagBinding;
}

function BindingEditorModalContent({element, binding}: BindingEditorProps) {
  const {
    name, setName, stateNames, canSave, scope, propertyRefs, code, setCode, viewRef, insertAtCursor,
    pickerOpen, setPickerOpen, addPropertyRef, removePropertyRef, mockValues, setMockValues,
    syntaxError, runTest, outcome, handleSave, closeModal,
  } = useBindingEditor(element, binding);

  return (
    <>
      <DialogHeader
        hint
        title={binding ? "Редактирование привязки" : "Новая привязка"}
        description={
          <>
            JavaScript-код исполняется в мониторе при изменении тегов и свойств. В скоупе — свойства-теги
            элемента и свойства других компонентов сцены и API: <code>setState(&quot;Имя&quot;)</code>,{" "}
            <code>setProp(&quot;color&quot;, значение)</code>, <code>self</code>.
            <br />
            <b>Переменная — это само значение</b>: пишите <code>ST &gt; 100</code>, без{" "}
            <code>.V</code>. Имя переменной — это <b>название свойства</b> со вкладки «Свойства»
            (переименуете свойство — переименуется и переменная), путь канала в коде не нужен.
            Значение — число, если строка парсится как число, иначе строка или <code>null</code>;
            исходная строка — <code>RAW.ST</code>.
          </>
        }
      />

      <DialogBody className="flex flex-col gap-4">
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
            className={scriptInputClasses}
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
          <TagChips scope={scope} onInsert={insertAtCursor} />

          {/* Свойства других компонентов сцены */}
          <PropertyRefChips
            refs={propertyRefs}
            titleOf={ref => `${ref.componentLabel} · ${ref.propertyName}${ref.valueType ? " · " + ref.valueType : ""}`}
            onInsert={ref => insertAtCursor(ref.varName)}
            onRemove={removePropertyRef}
            onPick={() => setPickerOpen(true)}
          />

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

        <ScriptCodeField code={code} setCode={setCode} viewRef={viewRef} />

        {/* Тест-прогон с мок-значениями */}
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
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!name.trim() || !code.trim() || !canSave || Boolean(syntaxError)}
          title={!canSave
            ? "У элемента нет сохранённого свойства — см. предупреждение выше"
            : syntaxError ? "Исправьте синтаксическую ошибку в коде" : undefined}
        >
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

export function openBindingEditorModal(props: BindingEditorProps) {
  const {openModal} = useModalStore.getState();
  openModal(<BindingEditorModalContent {...props} />, {size: "fullscreen", closeOnOverlay: false});
}
