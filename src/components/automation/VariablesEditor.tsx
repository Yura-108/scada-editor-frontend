"use client";

import React from "react";
import {Plus, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {
  AUTOMATION_VALUE_TYPES,
  VARIABLE_TAG_PREFIX,
  type AutomationTask,
  type AutomationValidationError,
  type AutomationValueType,
  type AutomationVariable,
} from "@/types/automation.types";

const input = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

interface Props {
  variables: AutomationVariable[];
  tasks: AutomationTask[];
  errors: AutomationValidationError[];
  /** Переменные и задачи меняются вместе: имя переменной живёт и в `writes_variables`. */
  onChange: (variables: AutomationVariable[], tasks: AutomationTask[]) => void;
}

/**
 * Переменные проекта — значения, которые задачи вычисляют и публикуют. На схеме они
 * привязываются как тег `@var.<имя>`; записать их из монитора нельзя, пишет только задача.
 *
 * Переменную без задачи-писателя бэкенд отклоняет, поэтому писатели выбираются прямо в строке.
 * Переименование и удаление переменной правят `writes_variables` всех задач: ссылка на
 * несуществующую переменную тоже не проходит проверку.
 */
export function VariablesEditor({variables, tasks, errors, onChange}: Props) {
  const patch = (index: number, value: Partial<AutomationVariable>) => {
    const prev = variables[index].name;
    const nextVariables = variables.map((v, i) => (i === index ? {...v, ...value} : v));
    const nextName = nextVariables[index].name;
    const nextTasks = value.name === undefined || prev === nextName ? tasks : tasks.map(t => (
      t.writes_variables.includes(prev)
        ? {...t, writes_variables: t.writes_variables.map(w => (w === prev ? nextName : w))}
        : t
    ));
    onChange(nextVariables, nextTasks);
  };

  const remove = (index: number) => {
    const name = variables[index].name;
    // Одноимённая переменная могла остаться (дубликат) — тогда ссылки задач ещё нужны.
    const stillExists = variables.some((v, i) => i !== index && v.name === name);
    onChange(
      variables.filter((_, i) => i !== index),
      stillExists ? tasks : tasks.map(t => (
        t.writes_variables.includes(name) ? {...t, writes_variables: t.writes_variables.filter(w => w !== name)} : t
      )),
    );
  };

  const toggleWriter = (taskIndex: number, name: string, on: boolean) =>
    onChange(variables, tasks.map((t, i) => {
      if (i !== taskIndex) return t;
      const without = t.writes_variables.filter(w => w !== name);
      return {...t, writes_variables: on ? [...without, name] : without};
    }));

  return (
    <div className="p-4 max-w-5xl">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Переменные проекта</h3>
          <Button onClick={() => onChange([...variables, {name: "", value_type: "float", default_value: null, description: null}], tasks)}>
            <Plus size={14} />Переменная
          </Button>
        </div>
        <div className="grid grid-cols-[1fr_100px_140px_1fr_1fr_auto] gap-2 text-xs uppercase tracking-wider text-neutral-500">
          <span>Имя</span><span>Тип</span><span>По умолчанию</span><span>Описание</span><span>Пишут задачи</span><span />
        </div>
        {variables.map((v, i) => {
          const writers = tasks.filter(t => v.name !== "" && t.writes_variables.includes(v.name));
          return (
            <div key={i} className="grid grid-cols-[1fr_100px_140px_1fr_1fr_auto] gap-2 items-start">
              <input className={input} value={v.name} placeholder="pump.speedSp" onChange={e => patch(i, {name: e.target.value})} title={`${VARIABLE_TAG_PREFIX}${v.name}`} />
              <select className={input} value={v.value_type} onChange={e => patch(i, {value_type: e.target.value as AutomationValueType})}>
                {AUTOMATION_VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className={input} value={v.default_value ?? ""} onChange={e => patch(i, {default_value: e.target.value === "" ? null : e.target.value})} />
              <input className={input} value={v.description ?? ""} onChange={e => patch(i, {description: e.target.value === "" ? null : e.target.value})} />
              <details className="relative">
                <summary className={cn(input, "cursor-pointer list-none truncate", writers.length === 0 && "text-amber-600 dark:text-amber-400")}>
                  {writers.length ? writers.map(t => t.name).join(", ") : "нет писателя"}
                </summary>
                <div className="absolute z-dropdown mt-1 w-full min-w-48 max-h-60 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 shadow-xl space-y-1">
                  {tasks.length === 0 && <p className="text-xs text-neutral-500">Задач нет — заведите на странице «Автоматизация».</p>}
                  {v.name === "" && tasks.length > 0 && <p className="text-xs text-neutral-500">Сначала задайте имя переменной.</p>}
                  {v.name !== "" && tasks.map((t, ti) => (
                    <label key={t.id ?? `new-${ti}`} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={t.writes_variables.includes(v.name)} onChange={e => toggleWriter(ti, v.name, e.target.checked)} />
                      <span className="truncate">{t.name}</span>
                    </label>
                  ))}
                </div>
              </details>
              <Button onClick={() => remove(i)} title="Удалить"><Trash2 size={14} /></Button>
            </div>
          );
        })}
        {errors.filter(e => e.field.startsWith("variables")).map((e, i) => (
          <p key={i} className="text-xs text-red-600">{e.message}</p>
        ))}
      </section>
    </div>
  );
}
