import React, { useMemo } from 'react';
import { AlertTriangle, CircleHelp, Clock, Package, Radio } from 'lucide-react';
import { useRuntimeOverlayStore } from '@/core/scene';
import { Badge } from '@/shared/ui/Badge';
import type { RuntimeStatus } from '../model/engine/runtimeConnection';
import { STATUS_VIEW } from '../lib/runtimeStatusView';

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
  hasScene,
  isArchive,
  status,
  statusDetail,
  isStale,
  compileErrors,
  runtimeErrors,
  releaseVersionNo,
}: Props) {
  const problemCount = useMemo(
    () => compileErrors.size + runtimeErrors.size,
    [compileErrors, runtimeErrors],
  );

  const statusView = STATUS_VIEW[hasScene ? status : 'closed'];
  // Сколько элементов схемы серые с «?»: раньше объяснения не было нигде — ни подсказки у
  // бейджа (он вне hit-графа), ни сводки, а рядом горело «Подключено» (#18 п. 12).
  const noDataCount = useRuntimeOverlayStore((s) => s.noDataKeys.size);

  return (
    <div className="flex items-center gap-1.5 max-2xl:[&>span]:px-1.5 2xl:gap-2">
      {problemCount > 0 && (
        <Badge
          tone="destructive"
          icon={<AlertTriangle size={12} />}
          title={[
            `Проблемы с привязками: ${problemCount}`,
            ...[...compileErrors.values()].map((e) => `Компиляция: ${e}`),
            ...[...runtimeErrors.values()].map((e) => `Исполнение: ${e}`),
          ].join('\n')}
        >
          <span className="hidden 2xl:inline">Проблемы с привязками: </span>
          {problemCount}
        </Badge>
      )}

      {!isArchive && isStale && (
        <Badge
          tone="warning"
          icon={<Clock size={12} />}
          title="Соединение живое, но новых значений давно не приходило — данные на экране могут быть устаревшими"
        >
          <span className="hidden 2xl:inline">Данные могут устареть</span>
        </Badge>
      )}

      {releaseVersionNo != null && (
        <Badge
          icon={<Package size={12} />}
          title={`Выпуск №${releaseVersionNo}. Монитор показывает prod-выпуск проекта. Правки редактора появятся здесь после нового выпуска.`}
        >
          <span className="hidden 2xl:inline">Выпуск </span>№{releaseVersionNo}
        </Badge>
      )}

      {hasScene && noDataCount > 0 && (
        <Badge
          icon={<CircleHelp size={12} />}
          title={
            `Нет достоверных данных у элементов схемы: ${noDataCount}. Такие элементы серые со значком «?»: ` +
            'их тег ещё не прислал значения или прислал значение с качеством не GOOD (нет связи с ПЛК, ' +
            'прибор неисправен). Соединение с сервером при этом может быть в порядке.'
          }
        >
          <span className="hidden 2xl:inline">Нет данных: </span>
          {noDataCount}
        </Badge>
      )}
      {!isArchive && (
        <Badge
          tone={statusView.tone}
          icon={<Radio size={12} />}
          title={statusDetail || statusView.label}
        >
          {/* С 1024 px: на ноутбуке от «Подключено» оставалась одна зелёная иконка (#18 п. 14). */}
          <span className="hidden lg:inline">{statusView.label}</span>
        </Badge>
      )}

      {/* Причина паузы рядом со статусом: «Переподключение…» без неё выглядит сбоем сети,
          хотя чинить надо остановленный экземпляр runtime, а не связь у оператора. */}
      {!isArchive && status === 'reconnecting' && statusDetail && (
        <span
          className="hidden max-w-40 truncate text-xs text-warning 2xl:inline"
          title={statusDetail}
        >
          {statusDetail}
        </span>
      )}
    </div>
  );
}
