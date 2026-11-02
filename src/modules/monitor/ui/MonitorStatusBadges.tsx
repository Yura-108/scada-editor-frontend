import React, {useMemo} from "react";
import {AlertTriangle, Clock, Package, Radio} from "lucide-react";
import {Badge} from "@/shared/ui/Badge";
import type {RuntimeStatus} from "../model/engine/runtimeConnection";
import {STATUS_VIEW} from "../lib/runtimeStatusView";

interface Props {
  hasScene: boolean;
  isArchive: boolean;
  status: RuntimeStatus;
  statusDetail: string | null | undefined;
  isStale: boolean;
  compileErrors: Map<string, string>;
  runtimeErrors: Map<string, string>;
  releaseVersionNo: number | null;
}

/** Значки шапки монитора: проблемы привязок, устаревшие данные, выпуск, статус соединения. */
export function MonitorStatusBadges({
  hasScene, isArchive, status, statusDetail, isStale, compileErrors, runtimeErrors, releaseVersionNo,
}: Props) {
  const problemCount = useMemo(
    () => compileErrors.size + runtimeErrors.size,
    [compileErrors, runtimeErrors],
  );

  const statusView = STATUS_VIEW[hasScene ? status : "closed"];

  return (
    <>
      {problemCount > 0 && (
        <Badge
          tone="destructive"
          icon={<AlertTriangle size={12} />}
          title={[`Проблемы с привязками: ${problemCount}`,
            ...[...compileErrors.values()].map(e => `Компиляция: ${e}`),
            ...[...runtimeErrors.values()].map(e => `Исполнение: ${e}`),
          ].join("\n")}
        >
          <span className="hidden xl:inline">Проблемы с привязками: </span>{problemCount}
        </Badge>
      )}

      {!isArchive && isStale && (
        <Badge
          tone="warning"
          icon={<Clock size={12} />}
          title="Соединение живое, но новых значений давно не приходило — данные на экране могут быть устаревшими"
        >
          <span className="hidden xl:inline">Данные могут устареть</span>
        </Badge>
      )}

      {releaseVersionNo != null && (
        <Badge
          icon={<Package size={12} />}
          title={`Выпуск №${releaseVersionNo}. Монитор показывает prod-выпуск проекта. Правки редактора появятся здесь после нового выпуска.`}
        >
          <span className="hidden xl:inline">Выпуск </span>№{releaseVersionNo}
        </Badge>
      )}

      {!isArchive && (
        <Badge tone={statusView.tone} icon={<Radio size={12} />} title={statusDetail || statusView.label}>
          <span className="hidden xl:inline">{statusView.label}</span>
        </Badge>
      )}

      {/* Причина паузы рядом со статусом: «Переподключение…» без неё выглядит сбоем сети,
          хотя чинить надо остановленный экземпляр runtime, а не связь у оператора. */}
      {!isArchive && status === "reconnecting" && statusDetail && (
        <span
          className="max-w-xs truncate text-xs text-warning"
          title={statusDetail}
        >
          {statusDetail}
        </span>
      )}
    </>
  );
}
