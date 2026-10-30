"use client";

import React, {useState} from "react";
import CodeMirror from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {X} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCreateTemplate, useUpdateTemplate} from "../api/templates";
import {AutomationSaveError} from "@/core/automation";
import {templateBody} from "../lib/automationTemplates";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {fieldLabelClass} from "@/shared/ui/field/fieldStyles";
import {IoTable} from "./IoTable";
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
  const closeModal = useCloseModal();
  const {mutateAsync: createTemplate} = useCreateTemplate();
  const {mutateAsync: updateTemplate} = useUpdateTemplate();

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
    <Field label={title} hint={hint} error={errorOf(field)}>
      <Input type="number" value={draft[field] ?? ""} onChange={e => setNumber(field, e.target.value)} />
    </Field>
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
          ? await updateTemplate({id: draft.id, template: body})
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
      <DialogHeader
        title={mode === "create" ? "Сохранить как шаблон" : "Правка шаблона"}
        description="Шаблон — заготовка задачи, общая для всех проектов. Теги в нём не хранятся: при вставке они вводятся заново, а пример показывается подсказкой."
      />

      <DialogBody>
        {generalError && (
          <Banner tone="destructive" className="mb-4">{generalError}</Banner>
        )}

        <div className="space-y-4 overflow-y-auto">
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Field label="Название" error={errorOf("name")}>
              <Input value={draft.name} onChange={e => set({name: e.target.value})} />
            </Field>
            <Field label="Категория">
              <Input placeholder="Без категории" value={draft.category ?? ""} onChange={e => set({category: e.target.value})} />
            </Field>
          </div>

          <Field label="Описание">
            <Input
              placeholder="Чем задача занимается и что нужно подставить"
              value={draft.description ?? ""}
              onChange={e => set({description: e.target.value})}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            {numberField("period_ms", "Период, мс", "100 … 3 600 000")}
            {numberField("timeout_ms", "Таймаут скрипта, мс", timeoutHint)}
            {numberField("stale_after_ms", "Вход устарел через, мс", "100 … 86 400 000")}
          </div>

          <Checkbox
            title="Выполнять такт, даже если входы устарели"
            checked={draft.run_on_stale}
            onChange={e => set({run_on_stale: e.target.checked})}
            label="Работать на устаревших входах"
          />

          {errorOf("inputs") && <p className="text-xs text-destructive">{errorOf("inputs")}</p>}
          <IoTable
            title="Входы"
            rows={toIoRows(draft.inputs)}
            onChange={rows => set({inputs: fromIoRows(rows)})}
            tagPlaceholder="пример тега — подсказка, не привязка"
          />
          {errorOf("outputs") && <p className="text-xs text-destructive">{errorOf("outputs")}</p>}
          <IoTable
            title="Выходы"
            rows={toIoRows(draft.outputs)}
            onChange={rows => set({outputs: fromIoRows(rows)})}
            tagPlaceholder="пример тега — подсказка, не привязка"
          />

          <div>
            <span className={fieldLabelClass}>Пишет переменные</span>
            <p className="text-xs text-muted-foreground mb-1">
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
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Убрать ${name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <Input
                size="sm"
                className="w-48"
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
            <span className={fieldLabelClass}>Скрипт (JavaScript)</span>
            <div className="border border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden">
              <CodeMirror
                value={draft.script}
                height="320px"
                extensions={[javascript()]}
                theme="dark"
                onChange={script => set({script})}
              />
            </div>
            {errorOf("script") && <p className="text-xs text-destructive mt-1">{errorOf("script")}</p>}
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !draft.name.trim()}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogFooter>
    </>
  );
}
