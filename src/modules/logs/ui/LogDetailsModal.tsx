'use client';

import React, {useState} from "react";
import {Slot} from "radix-ui";
import {LogEntry} from "../types/logs.type";
import {getDescription} from "../lib/getDescription"
import {Button} from "@/shared/ui/Button";
import Modal from "@/shared/ui/dialog/Modal";

interface LogDetailsModalProps {
  log: LogEntry;
  trigger: React.ReactNode;
}

/** Окно подробностей записи журнала; открывается кликом по `trigger`. */
export default function LogDetailsModal({ log, trigger }: LogDetailsModalProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Slot.Root onClick={() => setOpen(true)}>{trigger}</Slot.Root>
      <Modal
        open={open}
        onClose={close}
        size="lg"
        title={<>Детали лога #{log.id}</>}
        description={getDescription(log.commandType, log.entityType, log.entityId)}
        footer={<Button onClick={close}>Закрыть</Button>}
      >
        {log.commandType === 'UPDATE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Секция Payload */}
            <div className="space-y-2 min-w-0">
              <h4 className="text-sm font-medium text-success">Payload (Данные):</h4>
              <pre className="p-3 bg-muted rounded border border-border text-xs overflow-auto max-h-[300px] text-foreground">
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            </div>

            {/* Секция Undo Payload */}
            <div className="space-y-2 min-w-0">
              <h4 className="text-sm font-medium text-destructive">Undo Payload (Откат):</h4>
              <pre className="p-3 bg-muted rounded border border-border text-xs overflow-auto max-h-[300px] text-foreground">
                {JSON.stringify(log.undoPayload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
