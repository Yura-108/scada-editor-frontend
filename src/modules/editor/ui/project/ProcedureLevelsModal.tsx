"use client";

import React, {useEffect, useState} from "react";
import {toast} from "sonner";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {Button} from "@/shared/ui/Button";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {AccessLevelSelect} from "@/components/ui/AccessLevelSelect";
import {Banner} from "@/shared/ui/Banner";
import {Spinner} from "@/shared/ui/Spinner";
import {readBackendError, parseProcedureLevels} from "@/core/access";
import {PROCEDURE_OPERATIONS, type ProcedureLevels, type ProcedureOperation} from "@/types/access.types";

export const PROCEDURE_OPERATION_LABELS: Record<ProcedureOperation, string> = {
  start: "Запуск",
  confirm: "Подтверждение шага",
  pause: "Пауза",
  resume: "Продолжение",
  jump: "Переход к шагу",
  abort: "Прерывание",
};

/**
 * Таблица уровней операций процедур проекта. Это черновик проекта: в монитор (и в
 * проверки сервера) уровни попадают только с новым выпуском, ставшим prod.
 */
function ProcedureLevelsContent({projectId, projectName, editable}: {projectId: number; projectName: string; editable: boolean}) {
  const closeModal = useCloseModal();
  const [levels, setLevels] = useState<ProcedureLevels | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/editor/projects/${projectId}/procedure-levels`);
      if (cancelled) return;
      if (!res.ok) {
        setError(await readBackendError(res));
        return;
      }
      setLevels(parseProcedureLevels(await res.json().catch(() => null)));
    })().catch(err => !cancelled && setError((err as Error).message));
    return () => { cancelled = true; };
  }, [projectId]);

  const save = async () => {
    if (!levels) return;
    setSaving(true);
    try {
      // PUT заменяет все шесть полей — шлём полный набор.
      const res = await fetch(`/api/editor/projects/${projectId}/procedure-levels`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(levels),
      });
      if (!res.ok) {
        toast.error(await readBackendError(res));
        return;
      }
      toast.success("Уровни процедур сохранены. В мониторе они заработают с новым выпуском, ставшим prod");
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader
        title={<>Уровни процедур «{projectName}»</>}
        description="Минимальный уровень оператора для каждой операции процедуры. Пусто — уровень 1. Действует после выпуска проекта и назначения его prod."
      />

      <DialogBody>
        {error ? (
          <Banner tone="destructive">{error}</Banner>
        ) : !levels ? (
          <Spinner label="Загрузка…" />
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-center">
            {PROCEDURE_OPERATIONS.map(op => (
              <React.Fragment key={op}>
                <label htmlFor={`procedure-level-${op}`} className="text-sm">{PROCEDURE_OPERATION_LABELS[op]}</label>
                <AccessLevelSelect
                  id={`procedure-level-${op}`}
                  value={levels[op]}
                  disabled={!editable}
                  onChange={value => setLevels(l => (l ? {...l, [op]: value} : l))}
                />
              </React.Fragment>
            ))}
          </div>
        )}
        {!editable && <p className="mt-4 text-xs text-gray-500">Только просмотр — менять уровни может пользователь с правом правки.</p>}
      </DialogBody>
      <DialogFooter>
        <Button onClick={closeModal}>{editable ? "Отмена" : "Закрыть"}</Button>
        {editable && (
          <Button variant="primary" disabled={!levels || saving} onClick={() => void save()}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

/**
 * Уровни процедур — поверх окна, из которого открыли (список проектов): закрыли — список на месте.
 */
export function openProcedureLevelsModal(projectId: number, projectName: string, editable: boolean) {
  useModalStore.getState().pushModal(
    <ProcedureLevelsContent projectId={projectId} projectName={projectName} editable={editable} />,
    {size: "md"},
  );
}
