"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {AlertTriangle, CheckCircle2} from "lucide-react";
import {useModalStore} from "@/store/modalStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {Collapsible} from "@/components/ui/codeModalParts";
import type {CdbxImportReport} from "@/types/cdbxImport.types";

/**
 * Итог импорта. Списки объединённых и угаданных каналов бывают в сотни имён, поэтому лежат
 * под спойлером: цифра важна всем, перечень — тому, кто пойдёт проверять.
 */
function ImportReportContent({report}: {report: CdbxImportReport}) {
  const closeModal = useModalStore((s) => s.closeModal);
  const unmapped = report.unmapped ?? [];

  const list = (names: string[]) => (
    <ul className="max-h-48 overflow-y-auto space-y-0.5 text-xs text-gray-600 dark:text-gray-400 font-mono">
      {/* Имя в ключе не уникально: один и тот же канал бэкенд перечисляет столько раз,
          сколько групп в него слились. Это плоский список для чтения, порядок не меняется. */}
      {names.map((name, i) => <li key={`${name}-${i}`}>{name}</li>)}
    </ul>
  );

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        Импорт завершён
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Создан проект <b>{report.root}</b>: {report.channels} каналов, {report.nodes} узлов.
      </Dialog.Description>

      <div className="space-y-3">
        {report.merged.length > 0 && (
          <Collapsible
            title={`Объединено каналов: ${report.merged.length}`}
            badge={<span className="text-xs text-gray-500">одна переменная ПЛК была в двух группах</span>}
          >
            {list(report.merged)}
          </Collapsible>
        )}

        {report.guessedType.length > 0 && (
          <Collapsible
            title={`Тип данных угадан: ${report.guessedType.length}`}
            badge={<span className="text-xs text-amber-600 dark:text-amber-400">проверьте параметр «Тип данных»</span>}
          >
            {list(report.guessedType)}
          </Collapsible>
        )}

        {report.skipped.length > 0 && (
          <Collapsible
            title={`Пропущено: ${report.skipped.length}`}
            badge={<span className="text-xs text-gray-500">имена без поля</span>}
          >
            {list(report.skipped)}
          </Collapsible>
        )}

        {/* Длинный список — не мелочь, а признак исходников ПЛК от другой ревизии проекта:
            его показываем сразу, а не под спойлером (контракт, раздел 1.1). */}
        {unmapped.length > 3 ? (
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="mb-2 flex gap-2 font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {unmapped.length} объектов не нашлось в исходниках ПЛК и разложены по общему правилу.
              Возможно, файлы ПЛК от другой ревизии проекта.
            </p>
            {list(unmapped)}
          </div>
        ) : unmapped.length > 0 && (
          <Collapsible
            title={`Не найдено в исходниках ПЛК: ${unmapped.length}`}
            badge={<span className="text-xs text-gray-500">разложены по общему правилу</span>}
          >
            {list(unmapped)}
          </Collapsible>
        )}

        {report.merged.length === 0 && report.guessedType.length === 0 && report.skipped.length === 0 && unmapped.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Все каналы перенесены без замечаний.
          </p>
        )}

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Чтобы теги нового проекта пошли с контроллера, выгрузите блок для шлюза: правый клик
          по узлу проекта → «Выгрузить для шлюза».
        </p>
      </div>

      <ModalFooter>
        <Button variant="primary" onClick={closeModal}>Понятно</Button>
      </ModalFooter>
    </>
  );
}

export function openImportReportModal(report: CdbxImportReport) {
  useModalStore.getState().openModal(<ImportReportContent report={report} />);
}
