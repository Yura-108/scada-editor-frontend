"use client";

import React, {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import CodeMirror from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {X} from "lucide-react";
import {Button, ModalFooter} from "@/components/ui/Button";
import {useModalStore} from "@/store/modalStore";
import {useAutomationTemplateStore} from "@/store/useAutomationTemplateStore";
import {AutomationSaveError} from "@/lib/automation/automationApi";
import {templateBody} from "@/lib/automation/automationTemplates";
import {fieldInput, fieldLabel} from "@/components/automation/formStyles";
import {IoTable} from "@/components/automation/IoTable";
import type {AutomationIo, AutomationValidationError} from "@/types/automation.types";
import type {AutomationTaskTemplate, AutomationTemplateIo} from "@/types/automationTemplate.types";

interface Props {
  mode: "create" | "edit";
  /** У «create» это заготовка из задачи, у «edit» — шаблон с сервера. */
  initial: AutomationTaskTemplate;
  onSaved?: (template: AutomationTaskTemplate) => void;
}

type NumberField = "period_ms" | "timeout_ms" | "stale_after_ms";

const toInt = (raw: string): number => (raw === "" ? 0 : Math.trunc(Number(raw)));

/** IoTable говорит на языке задачи; у шаблона то же самое, только тег зовётся примером. */
const toIoRows = (rows: AutomationTemplateIo[]): AutomationIo[] =>
  rows.map(io => ({alias: io.alias, tag: io.example_tag ?? "", value_type: io.value_type}));

const fromIoRows = (rows: AutomationIo[]): AutomationTemplateIo[] =>
  rows.map(io => ({alias: io.alias, example_tag: io.tag.trim() || null, value_type: io.value_type}));

/**
 * Форма шаблона задачи — то же, что форма задачи, минус «включена» и теги, плюс категория
 * и описание. Открывается модалкой во весь экран: внутри редактор скрипта.
 *
 * Занятое имя приходит как `400` с `field: "name"`; модалка не закрывается, чтобы шаблон
 * можно было переименовать, не набирая всё заново.
 */
export function TemplateEditor({mode, initial, onSaved}: Props) {
  const closeModal = useModalStore(s => s.closeModal);
  const createTemplate = useAutomationTemplateStore(s => s.createTemplate);
  const updateTemplate = useAutomationTemplateStore(s => s.updateTemplate);

  const [draft, setDraft] = useState<AutomationTaskTemplate>(initial);
  const [errors, setErrors] = useState<AutomationValidationError[]>([]);
  const [saving, setSaving] = useState(false);
  const [variableDraft, setVariableDraft] = useState("");

  const set = (patch: Partial<AutomationTaskTemplate>) => setDraft(d => ({...d, ...patch}));
  const errorOf = (field: string) =>
    errors.filter(e => e.field === field).map(e => e.message).join("; ");

  const setNumber = (field: NumberField, raw: string) => {
    // Пустой таймаут — «по умолчанию» (100 мс), а не 0: ноль заведомо невалиден.
    if (field === "timeout_ms") set({timeout_ms: raw === "" ? undefined : toInt(raw)});
    else if (field === "period_ms") set({period_ms: toInt(raw)});
    else set({stale_after_ms: toInt(raw)});
  };

  const numberField = (field: NumberField, title: string, hint: string) => (
    <div>
      <label className={fieldLabel}>{title}</label>
      <input
        type="number"
        className={fieldInput}
        value={draft[field] ?? ""}
        onChange={e => setNumber(field, e.target.value)}
      />
      <p className={errorOf(field) ? "text-xs text-red-600 mt-1" : "text-xs text-neutral-500 mt-1"}>
        {errorOf(field) || hint}
      </p>
    </div>
  );

  const addVariable = () => {
    const name = variableDraft.trim();
    if (!name || draft.writes_variables.includes(name)) return setVariableDraft("");
    set({writes_variables: [...draft.writes_variables, name]});
    setVariableDraft("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = templateBody(draft);
      const saved =
        mode === "edit" && draft.id != null
          ? await updateTemplate(draft.id, body)
          : await createTemplate(body);
      setErrors([]);
      onSaved?.(saved);
      closeModal();
    } catch (err) {
      // Нарушения приходят все сразу — раскладываем по полям, модалку не закрываем.
      if (err instanceof AutomationSaveError && err.errors.length) setErrors(err.errors);
      else setErrors([{task: null, field: "", message: (err as Error).message}]);
    } finally {
      setSaving(false);
    }
  };

  // Умолчание таймаута (100 мс) бэкенд подставляет ДО проверки диапазона 1…период/2,
  // поэтому при периоде меньше 200 мс пустое поле гарантированно даёт отказ.
  const timeoutMax = Math.max(1, Math.floor(draft.period_ms / 2));
  const timeoutHint =
    draft.period_ms < 200
      ? `1 … ${timeoutMax} — при таком периоде заполните поле: умолчание 100 не пройдёт проверку`
      : `1 … ${timeoutMax}, пусто — 100`;
  const generalError = errors.find(e => !e.field)?.message;

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
        {mode === "create" ? "Сохранить как шаблон" : "Правка шаблона"}
      </Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Шаблон — заготовка задачи, общая для всех проектов. Теги в нём не хранятся: при вставке
        они вводятся заново, а пример показывается подсказкой.
      </Dialog.Description>

      {generalError && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-700 dark:text-red-300">
          {generalError}
        </div>
      )}

      <div className="space-y-4 overflow-y-auto">
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <div>
            <label className={fieldLabel}>Название</label>
            <input className={fieldInput} value={draft.name} onChange={e => set({name: e.target.value})} />
            {errorOf("name") && <p className="text-xs text-red-600 mt-1">{errorOf("name")}</p>}
          </div>
          <div>
            <label className={fieldLabel}>Категория</label>
            <input
              className={fieldInput}
              placeholder="Без категории"
              value={draft.category ?? ""}
              onChange={e => set({category: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className={fieldLabel}>Описание</label>
          <input
            className={fieldInput}
            placeholder="Чем задача занимается и что нужно подставить"
            value={draft.description ?? ""}
            onChange={e => set({description: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {numberField("period_ms", "Период, мс", "100 … 3 600 000")}
          {numberField("timeout_ms", "Таймаут скрипта, мс", timeoutHint)}
          {numberField("stale_after_ms", "Вход устарел через, мс", "100 … 86 400 000")}
        </div>

        <label className="flex items-center gap-2 text-sm" title="Выполнять такт, даже если входы устарели">
          <input
            type="checkbox"
            checked={draft.run_on_stale}
            onChange={e => set({run_on_stale: e.target.checked})}
          />
          Работать на устаревших входах
        </label>

        {errorOf("inputs") && <p className="text-xs text-red-600">{errorOf("inputs")}</p>}
        <IoTable
          title="Входы"
          rows={toIoRows(draft.inputs)}
          onChange={rows => set({inputs: fromIoRows(rows)})}
          tagPlaceholder="пример тега — подсказка, не привязка"
        />
        {errorOf("outputs") && <p className="text-xs text-red-600">{errorOf("outputs")}</p>}
        <IoTable
          title="Выходы"
          rows={toIoRows(draft.outputs)}
          onChange={rows => set({outputs: fromIoRows(rows)})}
          tagPlaceholder="пример тега — подсказка, не привязка"
        />

        <div>
          <span className={fieldLabel}>Пишет переменные</span>
          <p className="text-xs text-neutral-500 mb-1">
            Подсказка для вставки: переменных шаблон не создаёт, объявлены они должны быть в проекте.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {draft.writes_variables.map(name => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm bg-neutral-100 dark:bg-neutral-800"
              >
                {name}
                <button
                  type="button"
                  onClick={() => set({writes_variables: draft.writes_variables.filter(v => v !== name)})}
                  className="text-neutral-500 hover:text-red-500"
                  aria-label={`Убрать ${name}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm"
              placeholder="имя переменной, Enter"
              value={variableDraft}
              onChange={e => setVariableDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addVariable();
                }
              }}
              onBlur={addVariable}
            />
          </div>
        </div>

        <div>
          <span className={fieldLabel}>Скрипт (JavaScript)</span>
          <div className="border border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden">
            <CodeMirror
              value={draft.script}
              height="320px"
              extensions={[javascript()]}
              theme="dark"
              onChange={script => set({script})}
            />
          </div>
          {errorOf("script") && <p className="text-xs text-red-600 mt-1">{errorOf("script")}</p>}
        </div>
      </div>

      <ModalFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !draft.name.trim()}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </ModalFooter>
    </>
  );
}
