'use client';

import * as Dialog from '@radix-ui/react-dialog';
import React from "react";
import {LogEntry} from "@/types/logs.type";
import {getDescription} from "@/lib/getDescription"

interface LogDetailsModalProps {
  log: LogEntry;
  trigger: React.ReactNode;
}

export default function LogDetailsModal({ log, trigger }: LogDetailsModalProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {trigger}
      </Dialog.Trigger>

      <Dialog.Portal>
        {/* Затемнение фона */}
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-modal" />

        {/* Контент окна.
            flex-col + max-h + прокрутка внутри — как в ModalRoot: раньше высота
            была ничем не ограничена, и длинный лог уезжал за оба края экрана,
            так что до кнопки «Закрыть» было не добраться. */}
        <Dialog.Content className="fixed left-[50%] top-[50%] z-modal flex w-[95vw] max-w-2xl max-h-[92vh] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl duration-200 sm:rounded-lg">

          <div className="flex shrink-0 flex-col space-y-1.5 border-b border-gray-200 dark:border-gray-800 p-6 text-center sm:text-left">
            <Dialog.Title className="text-xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white">
              Детали лога #{log.id}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400">
              {getDescription(log.commandType, log.entityType, log.entityId)}
            </Dialog.Description>
          </div>

          {/* Прокручиваемая область: padding здесь, чтобы полоса прокрутки была у края */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
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
          </div>

          {/* Кнопка вне прокручиваемой области — всегда доступна */}
          <div className="flex shrink-0 justify-end border-t border-gray-200 dark:border-gray-800 p-4">
            <Dialog.Close asChild>
              <button className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md transition-colors">
                Закрыть
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

