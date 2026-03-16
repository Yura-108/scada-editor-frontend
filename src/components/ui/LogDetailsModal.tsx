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
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />

        {/* Контент окна */}
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-700 bg-gray-900 p-6 shadow-xl duration-200 sm:rounded-lg">

          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <Dialog.Title className="text-xl font-semibold leading-none tracking-tight text-white">
              Детали лога #{log.id}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-400">
              {getDescription(log.commandType, log.entityType, log.entityId)}
            </Dialog.Description>
          </div>

          {log.commandType === 'UPDATE' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Секция Payload */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-green-400">Payload (Данные):</h4>
                  <pre className="p-3 bg-black/40 rounded border border-gray-800 text-xs overflow-auto max-h-[300px] text-gray-300">
                {JSON.stringify(log.payload, null, 2)}
              </pre>
                </div>

                {/* Секция Undo Payload */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-red-400">Undo Payload (Откат):</h4>
                  <pre className="p-3 bg-black/40 rounded border border-gray-800 text-xs overflow-auto max-h-[300px] text-gray-300">
                {JSON.stringify(log.undoPayload, null, 2)}
              </pre>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end mt-4">
            <Dialog.Close asChild>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors">
                Закрыть
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}