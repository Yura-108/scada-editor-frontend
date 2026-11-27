import { shortTagPath } from '@/core/scene';
import {
  formatTs,
  journalTableBox,
  journalTbody,
  journalTd,
  journalTh,
  journalThead,
  JournalEmptyRow,
} from '@/modules/logs';
import { ACTION_KIND_LABEL, type ActionKind, type ActionLogRecord } from '@/modules/monitor';
import { Badge } from '@/shared/ui/Badge';

/** Что именно сделали: имя скрипта, операция процедуры или записанные теги. */
function ActionTarget({ r }: { r: ActionLogRecord }) {
  if ((r.kind === 'TAG_WRITE' || r.kind === 'PROPERTY_WRITE') && r.tags?.length) {
    return (
      <ul className="space-y-0.5">
        {r.tags.map((t, i) => (
          <li key={i} className="font-mono text-xs" title={t.tag ?? `свойство #${t.property}`}>
            {/* Запись свойства из инспектора несёт id свойства, а не тег. */}
            {t.tag ? shortTagPath(t.tag) : `свойство #${t.property ?? '?'}`} = {String(t.value)}
          </li>
        ))}
      </ul>
    );
  }
  // Действие с аргументами (выбор из меню `showMenu`): имя скрипта и что выбрали.
  if (r.kind === 'ACTION' && r.tags?.length) {
    return (
      <div>
        <span>{r.target ?? '—'}</span>
        <ul className="space-y-0.5">
          {r.tags.map((t, i) => (
            <li key={i} className="font-mono text-xs">
              {t.arg ?? '?'} ={' '}
              {typeof t.value === 'object' && t.value !== null
                ? JSON.stringify(t.value)
                : String(t.value)}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <span>{r.target ?? '—'}</span>;
}

export function ActionsTable({
  rows,
  loading,
  projectName,
}: {
  rows: ActionLogRecord[];
  loading: boolean;
  projectName: (id: number | null) => string;
}) {
  return (
    <div className={journalTableBox}>
      <table className="w-full text-sm">
        <thead className={journalThead}>
          <tr>
            <th className={journalTh}>Время</th>
            <th className={journalTh}>Пользователь</th>
            <th className={journalTh}>Проект</th>
            <th className={journalTh}>Вид</th>
            <th className={journalTh}>Компонент</th>
            <th className={journalTh}>Что сделано</th>
            <th className={journalTh}>Результат</th>
          </tr>
        </thead>
        <tbody className={journalTbody}>
          {rows.map((r, i) => (
            <tr key={`${r.ts}-${i}`} className="align-top">
              <td className={`${journalTd} whitespace-nowrap tabular-nums`}>{formatTs(r.ts)}</td>
              <td className={journalTd}>{r.username ?? '—'}</td>
              <td className={journalTd}>{projectName(r.projectId)}</td>
              <td className={`${journalTd} whitespace-nowrap`}>
                {ACTION_KIND_LABEL[r.kind as ActionKind] ?? r.kind}
              </td>
              <td className={journalTd}>{r.component ?? '—'}</td>
              <td className={journalTd}>
                <ActionTarget r={r} />
              </td>
              <td className={journalTd}>
                {r.outcome === 'OK' ? (
                  <Badge tone="success">OK</Badge>
                ) : (
                  <div className="space-y-1">
                    <Badge tone="destructive">{r.outcome === 'ERROR' ? 'Ошибка' : r.outcome}</Badge>
                    {r.error && (
                      <div className="text-xs text-destructive break-words">{r.error}</div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && !loading && (
            <JournalEmptyRow colSpan={7}>За выбранный период действий нет</JournalEmptyRow>
          )}
        </tbody>
      </table>
    </div>
  );
}
