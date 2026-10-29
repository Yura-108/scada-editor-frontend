"use client";

import React from "react";
import {FolderTree} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {pickTag} from "@/core/devices";
import {compactButton} from "./formStyles";
import type {AutomationValidationError, AutomationWatchdog} from "@/types/automation.types";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";

interface Props {
  watchdog: AutomationWatchdog | null;
  errors: AutomationValidationError[];
  onChange: (watchdog: AutomationWatchdog | null) => void;
  readOnly?: boolean;
}

/** Границы периода — как у бэкенда (AutomationSetValidator). */
const PERIOD_MIN = 100;
const PERIOD_MAX = 60_000;

/**
 * Watchdog проекта: счётчик, который automation пишет в тег ПЛК (runtime `WatchdogRunner`).
 * Счётчик растёт, пока проект исполняется и шлюз отвечает на команды не дольше трёх периодов.
 */
export function WatchdogEditor({watchdog, errors, onChange, readOnly = false}: Props) {
  const errorOf = (field: string) => errors.filter(e => e.field === field).map(e => e.message).join("; ");
  const otherErrors = errors.filter(e => e.field.startsWith("watchdog") && e.field !== "watchdog.tag" && e.field !== "watchdog.period_ms");

  const chooseTag = async () => {
    if (!watchdog) return;
    const tag = await pickTag({
      title: "Тег ПЛК для сторожевого счётчика",
      description: "Выберите канал целого типа (например, INT или WORD), который программа ПЛК читает как счётчик watchdog.",
    });
    if (tag) onChange({...watchdog, tag});
  };

  const periodHint = watchdog
    ? `Каждые ${watchdog.period_ms || "…"} мс счётчик увеличивается на 1. Допустимо ${PERIOD_MIN} … ${PERIOD_MAX.toLocaleString("ru")} мс.`
    : "";

  return (
    <fieldset disabled={readOnly} className="m-0 border-0 min-w-0 p-4 max-w-3xl space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Сторожевой таймер (watchdog)</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Пока автоматика работает, она с заданным периодом пишет в выбранный тег ПЛК счётчик
          0, 1, 2 … 65535, 0, 1 … Программа ПЛК следит за ним: если значение перестало меняться,
          значит автоматика остановилась или пропала связь, и ПЛК переводит оборудование
          в безопасный режим.
        </p>
        <p className="text-xs text-muted-foreground">
          Счётчик замирает, если проект не исполняется или шлюз не отвечает на команды дольше трёх периодов.
          Ошибки в скриптах задач его не останавливают — они видны в статусе задачи.
          В программе ПЛК порог обычно ставят в 3–5 периодов.
        </p>
      </section>

      <Checkbox
        checked={watchdog !== null}
        onChange={e => onChange(e.target.checked ? {tag: "", period_ms: 1000} : null)}
        label="Включён"
      />

      {watchdog && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
          <Field
            size="sm"
            label="Тег ПЛК для счётчика"
            error={errorOf("watchdog.tag")}
            hint={<>Полный путь канала из «Базы каналов», например <code>BN1.Нормализация.PLC1.WD_Counter</code>. Тип канала — целый (INT/WORD). Этот тег не должна писать ни одна задача.</>}
          >
            <div className="flex gap-2">
              <Input
                size="sm"
                placeholder="площадка.проект.устройство.канал"
                value={watchdog.tag}
                onChange={e => onChange({...watchdog, tag: e.target.value})}
              />
              <Button className={compactButton} onClick={() => void chooseTag()} title="Выбрать канал в дереве каналов">
                <FolderTree size={14} />Выбрать…
              </Button>
            </div>
          </Field>
          <Field size="sm" label="Период записи, мс" hint={periodHint} error={errorOf("watchdog.period_ms")}>
            <Input
              size="sm"
              type="number"
              min={PERIOD_MIN}
              max={PERIOD_MAX}
              step={100}
              value={watchdog.period_ms}
              onChange={e => onChange({...watchdog, period_ms: Math.trunc(Number(e.target.value))})}
            />
          </Field>
        </div>
      )}

      {otherErrors.map((e, i) => <p key={i} className="text-xs text-destructive">{e.message}</p>)}

      <p className="text-xs text-muted-foreground">
        {readOnly ? "Нет права правки — настройки только для просмотра." : "Изменения уходят на сервер кнопкой «Сохранить всё» вверху."}
      </p>
    </fieldset>
  );
}
