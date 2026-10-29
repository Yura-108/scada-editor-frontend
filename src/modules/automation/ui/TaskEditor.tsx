"use client";

import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {BookmarkPlus, Save, Undo2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {IoTable} from "./IoTable";
import {TagTreeSidebar} from "./TagTreeSidebar";
import {compactButton} from "./formStyles";
import type {TaskDraftState} from "../lib/automationDraft";
import type {AutomationTask, AutomationValidationError, AutomationVariable} from "@/types/automation.types";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";

interface Props {
  task: AutomationTask;
  variables: AutomationVariable[];
  errors: AutomationValidationError[];
  onChange: (task: AutomationTask) => void;
  /** Состояние задачи относительно сервера: от него зависят «Сохранить задачу» и «Отменить правки». */
  draftState: TaskDraftState;
  /** Нет — нет права правки, кнопок сохранения не показываем. */
  onSave?: () => void;
  /** Вернуть задачу к сохранённой на сервере. Нет — задача новая, возвращать не к чему. */
  onRevert?: () => void;
  saving: boolean;
  /** «В шаблоны» — задача становится заготовкой в общей палитре. */
  onSaveAsTemplate?: () => void;
  /** Нет права правки: поля заблокированы, а не просто «не сохранятся». */
  readOnly?: boolean;
}

type NumberField = "period_ms" | "timeout_ms" | "stale_after_ms";

const toInt = (raw: string): number => (raw === "" ? 0 : Math.trunc(Number(raw)));

const DRAFT_STATE_LABEL: Record<TaskDraftState, string> = {
  new: "Новая задача — ещё не сохранена",
  changed: "Есть несохранённые правки",
  saved: "Сохранена",
};

/**
 * Удаление живёт в списке задач (крестик с подтверждением), а не здесь: большая красная кнопка
 * рядом с полями ловила промахи.
 */
export function TaskEditor({task, variables, errors, onChange, draftState, onSave, onRevert, saving, onSaveAsTemplate, readOnly = false}: Props) {
  const set = (patch: Partial<AutomationTask>) => onChange({...task, ...patch});
  const errorOf = (field: string) => errors.filter(e => e.field === field).map(e => e.message).join("; ");

  const setNumber = (field: NumberField, raw: string) => {
    // Пустой таймаут — «по умолчанию» (100 мс на бэкенде), а не 0: ноль заведомо невалиден.
    if (field === "timeout_ms") set({timeout_ms: raw === "" ? null : toInt(raw)});
    else if (field === "period_ms") set({period_ms: toInt(raw)});
    else set({stale_after_ms: toInt(raw)});
  };

  const numberField = (field: NumberField, title: string, hint: string) => (
    <Field size="sm" label={title} hint={hint} error={errorOf(field)}>
      <Input size="sm" type="number" value={task[field] ?? ""} onChange={e => setNumber(field, e.target.value)} />
    </Field>
  );

  const toggleWrite = (name: string, on: boolean) =>
    set({writes_variables: on ? [...task.writes_variables, name] : task.writes_variables.filter(v => v !== name)});

  return (
    <div className="h-full flex">
      {/* fieldset disabled блокирует разом все поля и кнопки формы; дерево тегов справа — вне
          него, по нему можно искать и в режиме просмотра. */}
      <fieldset disabled={readOnly} className="flex-1 min-w-0 m-0 border-0 overflow-y-auto p-4 pb-28 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field size="sm" label="Название" error={errorOf("name")} className="flex-1 min-w-56">
            <Input size="sm" value={task.name} onChange={e => set({name: e.target.value})} />
          </Field>
          <div className="flex items-center gap-2">
            {onSaveAsTemplate && (
              <Button className={compactButton} onClick={onSaveAsTemplate} title="Сохранить задачу заготовкой в палитру шаблонов">
                <BookmarkPlus size={14} />В шаблоны
              </Button>
            )}
            {onRevert && draftState === "changed" && (
              <Button className={compactButton} onClick={onRevert} disabled={saving} title="Вернуть задачу к сохранённой на сервере">
                <Undo2 size={14} />Отменить правки
              </Button>
            )}
            {onSave && (
              <Button
                variant="primary"
                className={compactButton}
                onClick={onSave}
                disabled={draftState === "saved" || saving}
                title="Сохранить только эту задачу — правки остальных задач останутся черновиком"
              >
                <Save size={14} />{saving ? "Сохранение…" : "Сохранить задачу"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Checkbox checked={task.enabled} onChange={e => set({enabled: e.target.checked})} label="Включена" />
          <Checkbox
            title="Выполнять такт, даже если входы устарели (скрипт сам проверяет input(alias).stale)"
            checked={task.run_on_stale}
            onChange={e => set({run_on_stale: e.target.checked})}
            label="Работать на устаревших входах"
          />
          <span className={cn("ml-auto text-xs", draftState === "saved" ? "text-muted-foreground" : "text-warning")}>
            {DRAFT_STATE_LABEL[draftState]}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {numberField("period_ms", "Период, мс", "100 … 3 600 000")}
          {numberField("timeout_ms", "Таймаут скрипта, мс", `1 … ${Math.max(1, Math.floor(task.period_ms / 2))}, пусто — 100`)}
          {numberField("stale_after_ms", "Вход устарел через, мс", "100 … 86 400 000")}
        </div>

        {errorOf("inputs") && <p className="text-xs text-destructive">{errorOf("inputs")}</p>}
        <IoTable title="Входы" rows={task.inputs} onChange={inputs => set({inputs})} />
        {errorOf("outputs") && <p className="text-xs text-destructive">{errorOf("outputs")}</p>}
        <IoTable title="Выходы" rows={task.outputs} onChange={outputs => set({outputs})} />

        <div>
          <span className={fieldLabelSmClass}>Пишет переменные</span>
          {variables.length === 0 && <p className="text-xs text-muted-foreground">Переменных проекта нет — заведите в разделе «Данные проекта» → «Переменные».</p>}
          <div className="flex flex-wrap gap-3">
            {variables.map(v => (
              <Checkbox
                key={v.name}
                checked={task.writes_variables.includes(v.name)}
                onChange={e => toggleWrite(v.name, e.target.checked)}
                label={v.name}
              />
            ))}
          </div>
          {errorOf("writes_variables") && <p className="text-xs text-destructive mt-1">{errorOf("writes_variables")}</p>}
        </div>

        <div>
          <span className={fieldLabelSmClass}>Скрипт (JavaScript)</span>
          <p className="text-xs text-muted-foreground mb-1">
            inputs.alias · input(alias) → {"{value, good, ageMs, stale}"} · write(alias, value) · vars.имя · setVar(имя, value) ·
            state (объект, до 64 КБ) · dt · firstRun · log.info(...) / log.warn(...)
          </p>
          <div className="border border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden">
            <CodeMirror value={task.script} height="360px" extensions={[javascript()]} theme="dark" readOnly={readOnly} editable={!readOnly} onChange={script => set({script})} />
          </div>
          {errorOf("script") && <p className="text-xs text-destructive mt-1">{errorOf("script")}</p>}
        </div>
      </fieldset>

      <TagTreeSidebar />
    </div>
  );
}
