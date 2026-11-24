import React from "react";
import {Check, CircleStop, Pause, Play} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import type {ProcedureStatus} from "@/core/project";
import type {useProcedureControls} from "../../model/procedures/useProcedureControls";

export type ProcedureControls = ReturnType<typeof useProcedureControls>;

/** Общий вид кнопок HUD. */
export const hudIconButton = cn(
  "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
  "disabled:opacity-40 disabled:cursor-not-allowed",
);

interface Props {
  recipeId: string;
  status: ProcedureStatus | null;
  isRunning: boolean;
  controls: ProcedureControls;
}

/** Кнопки ведения процедуры: запуск, подтверждение шага, пауза/продолжение, прерывание. */
export function HudControls({recipeId, status, isRunning, controls}: Props) {
  const {busy, denied, start, confirm, pause, resume, abort} = controls;

  return (
    <>
      {!isRunning && (
        <button
          className={cn(hudIconButton, "gap-1 px-2 bg-primary text-primary-foreground hover:bg-primary/90")}
          disabled={busy || !!denied.start}
          onClick={() => start(recipeId)}
          title={denied.start ?? "Запустить процедуру"}
        >
          <Play size={13} />
          <span className="text-xs font-medium">Запустить</span>
        </button>
      )}

      {isRunning && (
        <>
          <button
            className={cn(hudIconButton, "gap-1 px-2 bg-primary text-primary-foreground hover:bg-primary/90")}
            disabled={busy || !!denied.confirm}
            onClick={() => confirm(recipeId)}
            title={denied.confirm ?? "Подтвердить текущий шаг"}
          >
            <Check size={13} />
            <span className="text-xs font-medium">Подтвердить</span>
          </button>
          {/* Пауза настоящая, серверная: рантайм переводит оборудование в `pause_action`
              рецепта и останавливает продвижение по шагам. На паузу процедура встаёт и
              сама, пока активна авария, — тогда «Продолжить» ответит отказом с её текстом,
              и это не сбой, а причина, по которой продолжать нельзя. */}
          {status?.paused ? (
            <button
              className={cn(hudIconButton, "gap-1 px-2 bg-success text-success-foreground hover:bg-success/90")}
              disabled={busy || !!denied.resume}
              onClick={() => resume(recipeId)}
              title={denied.resume ?? "Продолжить процедуру: теги безопасного состояния вернутся к значениям текущего шага"}
            >
              <Play size={13} />
              <span className="text-xs font-medium">Продолжить</span>
            </button>
          ) : (
            <button
              className={cn(hudIconButton, "gap-1 px-2 bg-warning text-warning-foreground hover:bg-warning/90")}
              disabled={busy || !!denied.pause}
              onClick={() => pause(recipeId)}
              title={denied.pause ?? "Пауза: оборудование перейдёт в безопасное состояние рецепта"}
            >
              <Pause size={13} />
              <span className="text-xs font-medium">Пауза</span>
            </button>
          )}
          <button
            className={cn(hudIconButton, "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            disabled={busy || !!denied.abort}
            onClick={() => abort(recipeId)}
            title={denied.abort ?? "Прервать процедуру"}
          >
            <CircleStop size={14} />
          </button>
        </>
      )}
    </>
  );
}
