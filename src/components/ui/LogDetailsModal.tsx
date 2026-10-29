'use client';

import React, {useState} from "react";
import {Slot} from "radix-ui";
import {LogEntry} from "@/types/logs.type";
import {getDescription} from "@/lib/getDescription"
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
              <h4 className="text-sm font-medium text-green-700 dark:text-green-400">Payload (Данные):</h4>
              <pre className="p-3 bg-gray-50 dark:bg-black/40 rounded border border-gray-200 dark:border-gray-800 text-xs overflow-auto max-h-[300px] text-gray-700 dark:text-gray-300">
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            </div>

            {/* Секция Undo Payload */}
            <div className="space-y-2 min-w-0">
              <h4 className="text-sm font-medium text-red-700 dark:text-red-400">Undo Payload (Откат):</h4>
              <pre className="p-3 bg-gray-50 dark:bg-black/40 rounded border border-gray-200 dark:border-gray-800 text-xs overflow-auto max-h-[300px] text-gray-700 dark:text-gray-300">
                {JSON.stringify(log.undoPayload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
