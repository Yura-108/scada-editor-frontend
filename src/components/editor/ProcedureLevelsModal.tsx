"use client";

import React, {useEffect, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {toast} from "sonner";
import {useModalStore} from "@/store/modalStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {AccessLevelSelect} from "@/components/ui/AccessLevelSelect";
import {readBackendError} from "@/lib/access/accessErrors";
import {PROCEDURE_OPERATIONS, type ProcedureLevels, type ProcedureOperation} from "@/types/access.types";
import {parseProcedureLevels} from "@/lib/access/procedureLevels";

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
  const closeModal = useModalStore(s => s.closeModal);
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
    <div className="w-full max-w-md">
      <Dialog.Title className="text-xl font-semibold mb-1">Уровни процедур «{projectName}»</Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Минимальный уровень оператора для каждой операции процедуры. Пусто — уровень 1.
        Действует после выпуска проекта и назначения его prod.
      </Dialog.Description>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !levels ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
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
      <ModalFooter>
        <Button onClick={closeModal}>{editable ? "Отмена" : "Закрыть"}</Button>
        {editable && (
          <Button variant="primary" disabled={!levels || saving} onClick={() => void save()}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        )}
      </ModalFooter>
    </div>
  );
}

export function openProcedureLevelsModal(projectId: number, projectName: string, editable: boolean) {
  useModalStore.getState().openModal(
    <ProcedureLevelsContent projectId={projectId} projectName={projectName} editable={editable} />,
  );
}
