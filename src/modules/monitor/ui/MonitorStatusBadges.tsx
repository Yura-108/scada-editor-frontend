"use client";

import React from "react";
import {AlertTriangle, Clock, Package, Radio} from "lucide-react";
import type {RuntimeStatus} from "@/lib/runtime/runtimeConnection";
import {cn} from "@/shared/lib/cn";

const STATUS_VIEW: Record<RuntimeStatus, {label: string; className: string}> = {
  connecting: {label: "Подключение…", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  live: {label: "Живые данные", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"},
  reconnecting: {label: "Переподключение…", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  closed: {label: "Нет соединения", className: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400"},
  // Окончательный отказ: код закрытия 1003 либо 409 на создание сессии (проект не введён
  // в эксплуатацию). Реконнект не запускается — причина показывается оператору прямо на
  // холсте, иначе выключенный проект выглядел бы неисправностью экрана.
  rejected: {label: "Соединение отклонено", className: "bg-red-500/15 text-red-600 dark:text-red-400"},
  // Код закрытия 4403: права в проекте отозваны. Монитор сам уходит к выбору проекта.
  revoked: {label: "Доступ отозван", className: "bg-red-500/15 text-red-600 dark:text-red-400"},
};

interface MonitorStatusBadgesProps {
  status: RuntimeStatus;
  /** Без открытой схемы статус показывается как "closed". */
  hasScene: boolean;
  statusDetail: string | null | undefined;
  isArchive: boolean;
  isStale: boolean;
  compileErrors: ReadonlyMap<string, string>;
  runtimeErrors: ReadonlyMap<string, string>;
  releaseVersionNo: number | null;
}

/** Правая часть тулбара монитора: проблемы привязок, устаревание, выпуск, соединение. */
export function MonitorStatusBadges({
  status, hasScene, statusDetail, isArchive, isStale, compileErrors, runtimeErrors, releaseVersionNo,
}: MonitorStatusBadgesProps) {
  const problemCount = compileErrors.size + runtimeErrors.size;
  const statusView = STATUS_VIEW[hasScene ? status : "closed"];

  return (
    <>
      {problemCount > 0 && (
        <span
          className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-600 dark:text-red-400"
          title={[`Проблемы с привязками: ${problemCount}`,
            ...[...compileErrors.values()].map(e => `Компиляция: ${e}`),
            ...[...runtimeErrors.values()].map(e => `Исполнение: ${e}`),
          ].join("\n")}
        >
          <AlertTriangle size={14} />
          <span className="hidden xl:inline">Проблемы с привязками: </span>{problemCount}
        </span>
      )}

      {!isArchive && isStale && (
        <span
          className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400"
          title="Соединение живое, но новых значений давно не приходило — данные на экране могут быть устаревшими"
        >
          <Clock size={14} />
          <span className="hidden xl:inline">Данные могут устареть</span>
        </span>
      )}

      {releaseVersionNo != null && (
        <span
          className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-500/10 text-neutral-600 dark:text-neutral-300"
          title={`Выпуск №${releaseVersionNo}. Монитор показывает prod-выпуск проекта. Правки редактора появятся здесь после нового выпуска.`}
        >
          <Package size={14} />
          <span className="hidden xl:inline">Выпуск </span>№{releaseVersionNo}
        </span>
      )}

      {!isArchive && (
        <span
          className={cn("flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", statusView.className)}
          title={statusDetail || statusView.label}
        >
          <Radio size={14} />
          <span className="hidden xl:inline">{statusView.label}</span>
        </span>
      )}

      {/* Причина паузы рядом со статусом: «Переподключение…» без неё выглядит сбоем сети,
          хотя чинить надо остановленный экземпляр runtime, а не связь у оператора. */}
      {!isArchive && status === "reconnecting" && statusDetail && (
        <span
          className="max-w-xs truncate text-xs text-amber-600 dark:text-amber-400"
          title={statusDetail}
        >
          {statusDetail}
        </span>
      )}
    </>
  );
}
