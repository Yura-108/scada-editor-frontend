import React from "react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {cn} from "@/shared/lib/cn";
import {TitleWithHint} from "@/shared/ui/codeModalParts";
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
    <div className="flex flex-col h-full gap-4">
      <TitleWithHint
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
          disabled={!name.trim() || !code.trim() || !canSave || Boolean(syntaxError)}
          title={!canSave
            ? "У элемента нет сохранённого свойства — см. предупреждение выше"
            : syntaxError ? "Исправьте синтаксическую ошибку в коде" : undefined}
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
  openModal(<BindingEditorModalContent {...props} />, {size: "fullscreen", legacyLayout: true});
}
