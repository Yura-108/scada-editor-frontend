'use client';

import React, {useState} from "react";
import {Slot} from "radix-ui";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import Modal from "@/shared/ui/dialog/Modal";
import {LogEntry} from "../types/logs.type";
import {logActionLabel, logFieldRows, logObjectTitle, parseLogKind} from "../lib/describeLog";
import {useParamTypeName} from "../model/useParamTypeName";

interface LogDetailsModalProps {
  log: LogEntry;
  trigger: React.ReactNode;
}

/**
 * Окно подробностей записи журнала: таблица «Поле | Было | Стало» с понятными названиями,
 * сырой JSON — под «Технические данные» (#14 п. 2). Раньше здесь были два блока JSON, и то
 * только при `commandType === 'UPDATE'`, которого сервер не присылает, — окно было пустым.
 */
export default function LogDetailsModal({ log, trigger }: LogDetailsModalProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const typeName = useParamTypeName();

  const kind = parseLogKind(log);
  const what = kind.target === 'node' ? 'устройство' : 'параметр';
  const rows = logFieldRows(log, typeName);
  const hasBefore = rows.some(r => r.before != null);
  const hasAfter = rows.some(r => r.after != null);

  return (
    <>
      <Slot.Root onClick={() => setOpen(true)}>{trigger}</Slot.Root>
      <Modal
        open={open}
        onClose={close}
        size="lg"
        title={<>{logActionLabel(kind, log.commandType)}: {what}</>}
        description={logObjectTitle(log, typeName) ?? `${what} №${log.entityId}`}
        footer={<Button onClick={close}>Закрыть</Button>}
      >
        {rows.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Поле</th>
                {hasBefore && <th className="py-2 pr-3 font-medium">Было</th>}
                {hasAfter && <th className="py-2 font-medium">{hasBefore ? 'Стало' : 'Значение'}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.label} className="border-b border-border align-top">
                  <td className="py-2 pr-3 text-muted-foreground">{r.label}</td>
                  {hasBefore && (
                    <td className={cn("py-2 pr-3 break-words", r.changed && "text-destructive line-through")}>{r.before ?? '—'}</td>
                  )}
                  {hasAfter && (
                    <td className={cn("py-2 break-words", r.changed && "font-medium text-success")}>{r.after ?? '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">В записи нет данных об объекте.</p>
        )}

        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Технические данные</summary>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <div>Запись #{log.id} · {log.commandType} · {log.entityType} №{log.entityId}{log.batchId ? ` · операция ${log.batchId}` : ''}</div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {([['payload', log.payload], ['undoPayload', log.undoPayload]] as const).map(([name, value]) => (
              <div key={name} className="min-w-0 space-y-1">
                <div className="font-mono text-muted-foreground">{name}</div>
                <pre className="overflow-auto rounded border border-border bg-muted p-3 text-foreground max-h-[260px]">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </details>
      </Modal>
    </>
  );
}
