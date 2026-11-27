'use client';

import React from 'react';
import { ListChecks, Plus, Trash2, Variable } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import {
  AUTOMATION_VALUE_TYPES,
  VARIABLE_TAG_PREFIX,
  type AutomationTask,
  type AutomationValidationError,
  type AutomationValueType,
  type AutomationVariable,
} from '@/core/automation';
import { EmptyState } from '@/shared/ui/EmptyState';
import { MultiSelect } from '@/shared/ui/MultiSelect';
import { Input } from '@/shared/ui/field/Input';
import { Select } from '@/shared/ui/field/Select';

const ROW_GRID = 'grid grid-cols-[1fr_100px_140px_1fr_1fr_auto] gap-2';

/** Подсказка в пустом «Имени» — с «например», чтобы её не принимали за введённое имя (#23 п. 3). */
const NAME_PLACEHOLDER = 'Имя, например pump.speedSp';

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
export function VariablesEditor({ variables, tasks, errors, onChange }: Props) {
  const patch = (index: number, value: Partial<AutomationVariable>) => {
    const prev = variables[index].name;
    const nextVariables = variables.map((v, i) => (i === index ? { ...v, ...value } : v));
    const nextName = nextVariables[index].name;
    const nextTasks =
      value.name === undefined || prev === nextName
        ? tasks
        : tasks.map((t) =>
            t.writes_variables.includes(prev)
              ? {
                  ...t,
                  writes_variables: t.writes_variables.map((w) => (w === prev ? nextName : w)),
                }
              : t,
          );
    onChange(nextVariables, nextTasks);
  };

  const remove = (index: number) => {
    const name = variables[index].name;
    // Одноимённая переменная могла остаться (дубликат) — тогда ссылки задач ещё нужны.
    const stillExists = variables.some((v, i) => i !== index && v.name === name);
    onChange(
      variables.filter((_, i) => i !== index),
      stillExists
        ? tasks
        : tasks.map((t) =>
            t.writes_variables.includes(name)
              ? { ...t, writes_variables: t.writes_variables.filter((w) => w !== name) }
              : t,
          ),
    );
  };

  /** Писатели переменной — номера задач в списке: у новой задачи ещё нет `id`. */
  const setWriters = (name: string, taskIndexes: string[]) => {
    const on = new Set(taskIndexes);
    onChange(
      variables,
      tasks.map((t, i) => {
        const without = t.writes_variables.filter((w) => w !== name);
        return { ...t, writes_variables: on.has(String(i)) ? [...without, name] : without };
      }),
    );
  };
  const taskOptions = tasks.map((t, i) => ({ value: String(i), label: t.name }));

  return (
    <div className="p-4 max-w-5xl">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Переменные проекта</h3>
          <Button
            onClick={() =>
              onChange(
                [
                  ...variables,
                  { name: '', value_type: 'float', default_value: null, description: null },
                ],
                tasks,
              )
            }
          >
            <Plus size={14} />
            Переменная
          </Button>
        </div>
        {/* Подписи колонок — только вместе со строками: без них это недорисованная таблица (#23 п. 1). */}
        {variables.length === 0 ? (
          <EmptyState
            size="sm"
            icon={Variable}
            className="rounded-lg border border-dashed"
            title="Переменных пока нет"
            description="Переменная хранит значение, которое задачи автоматизации записывают и читают. Нажмите «+ Переменная», чтобы добавить первую."
          />
        ) : (
          <div className={cn(ROW_GRID, 'text-xs uppercase tracking-wider text-muted-foreground')}>
            <span>Имя</span>
            <span>Тип</span>
            <span>По умолчанию</span>
            <span>Описание</span>
            <span>Пишут задачи</span>
            <span />
          </div>
        )}
        {variables.map((v, i) => {
          const writers =
            v.name === ''
              ? []
              : taskOptions
                  .filter((_, ti) => tasks[ti].writes_variables.includes(v.name))
                  .map((o) => o.value);
          return (
            <div key={i} className={cn(ROW_GRID, 'items-start')}>
              <Input
                size="sm"
                value={v.name}
                placeholder={NAME_PLACEHOLDER}
                onChange={(e) => patch(i, { name: e.target.value })}
                title={`${VARIABLE_TAG_PREFIX}${v.name}`}
              />
              <Select
                size="sm"
                value={v.value_type}
                onValueChange={(val) => patch(i, { value_type: val as AutomationValueType })}
                options={AUTOMATION_VALUE_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <Input
                size="sm"
                value={v.default_value ?? ''}
                onChange={(e) =>
                  patch(i, { default_value: e.target.value === '' ? null : e.target.value })
                }
              />
              <Input
                size="sm"
                value={v.description ?? ''}
                onChange={(e) =>
                  patch(i, { description: e.target.value === '' ? null : e.target.value })
                }
              />
              {/* Общий выпадающий список: закрывается щелчком мимо и по Esc, открыт только один.
                  Раньше это был <details> — он закрывался лишь по своей же строке (#23 п. 2). */}
              <MultiSelect
                label="Задачи, которые записывают переменную"
                options={taskOptions}
                selected={writers}
                onChange={(values) => setWriters(v.name, values)}
                icon={<ListChecks />}
                disabled={v.name === '' || tasks.length === 0}
                placeholder={
                  tasks.length === 0 ? 'задач нет' : v.name === '' ? 'сначала имя' : 'нет писателя'
                }
                className={cn('w-full', v.name !== '' && writers.length === 0 && 'border-warning')}
              />
              <IconButton
                icon={Trash2}
                label="Удалить переменную"
                title="Удалить"
                variant="danger"
                onClick={() => remove(i)}
              />
            </div>
          );
        })}
        {errors
          .filter((e) => e.field.startsWith('variables'))
          .map((e, i) => (
            <p key={i} className="text-xs text-destructive">
              {e.message}
            </p>
          ))}
      </section>
    </div>
  );
}
