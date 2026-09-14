"use client";

import React from "react";
import {Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/Button";
import {
  AUTOMATION_VALUE_TYPES,
  VARIABLE_TAG_PREFIX,
  type AutomationValidationError,
  type AutomationValueType,
  type AutomationVariable,
  type AutomationWatchdog,
} from "@/types/automation.types";

const input = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

interface Props {
  variables: AutomationVariable[];
  watchdog: AutomationWatchdog | null;
  errors: AutomationValidationError[];
  onVariablesChange: (variables: AutomationVariable[]) => void;
  onWatchdogChange: (watchdog: AutomationWatchdog | null) => void;
}

/**
 * Переменные проекта — значения, которые задачи вычисляют и публикуют. На схеме они
 * привязываются как тег `@var.<имя>`; записать их из монитора нельзя, пишет только задача.
 */
export function VariablesEditor({variables, watchdog, errors, onVariablesChange, onWatchdogChange}: Props) {
  const patch = (index: number, value: Partial<AutomationVariable>) =>
    onVariablesChange(variables.map((v, i) => (i === index ? {...v, ...value} : v)));

  return (
    <div className="p-4 space-y-8 max-w-4xl">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Переменные проекта</h3>
          <Button onClick={() => onVariablesChange([...variables, {name: "", value_type: "float", default_value: null, description: null}])}>
            <Plus size={14} />Переменная
          </Button>
        </div>
        <div className="grid grid-cols-[1fr_100px_140px_1fr_auto] gap-2 text-xs uppercase tracking-wider text-neutral-500">
          <span>Имя</span><span>Тип</span><span>По умолчанию</span><span>Описание</span><span />
        </div>
        {variables.map((v, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_140px_1fr_auto] gap-2 items-center">
            <input className={input} value={v.name} placeholder="pump.speedSp" onChange={e => patch(i, {name: e.target.value})} title={`${VARIABLE_TAG_PREFIX}${v.name}`} />
            <select className={input} value={v.value_type} onChange={e => patch(i, {value_type: e.target.value as AutomationValueType})}>
              {AUTOMATION_VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={input} value={v.default_value ?? ""} onChange={e => patch(i, {default_value: e.target.value === "" ? null : e.target.value})} />
            <input className={input} value={v.description ?? ""} onChange={e => patch(i, {description: e.target.value === "" ? null : e.target.value})} />
            <Button onClick={() => onVariablesChange(variables.filter((_, j) => j !== i))} title="Удалить"><Trash2 size={14} /></Button>
          </div>
        ))}
        {errors.filter(e => e.field.startsWith("variables")).map((e, i) => (
          <p key={i} className="text-xs text-red-600">{e.message}</p>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Watchdog</h3>
        <p className="text-xs text-neutral-500">
          Счётчик 0…65535, который automation пишет в тег ПЛК с заданным периодом. ПЛК по застывшему
          счётчику понимает, что автоматика остановилась, и переходит в безопасный режим.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={watchdog !== null} onChange={e => onWatchdogChange(e.target.checked ? {tag: "", period_ms: 1000} : null)} />
          Включён
        </label>
        {watchdog && (
          <div className="grid grid-cols-[1fr_160px] gap-2">
            <input className={input} placeholder="путь тега ПЛК" value={watchdog.tag} onChange={e => onWatchdogChange({...watchdog, tag: e.target.value})} />
            <input className={input} type="number" value={watchdog.period_ms} onChange={e => onWatchdogChange({...watchdog, period_ms: Math.trunc(Number(e.target.value))})} title="100 … 60 000 мс" />
          </div>
        )}
        {errors.filter(e => e.field.startsWith("watchdog")).map((e, i) => (
          <p key={i} className="text-xs text-red-600">{e.message}</p>
        ))}
      </section>
    </div>
  );
}
