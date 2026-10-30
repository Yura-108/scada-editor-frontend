"use client";

import React from "react";
import {AlertTriangle, CheckCircle2} from "lucide-react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {Collapsible} from "@/shared/ui/codeModalParts";
import type {CdbxImportReport} from "@/types/cdbxImport.types";

/**
 * Итог импорта. Списки объединённых и угаданных каналов бывают в сотни имён, поэтому лежат
 * под спойлером: цифра важна всем, перечень — тому, кто пойдёт проверять.
 */
function ImportReportContent({report}: {report: CdbxImportReport}) {
  const closeModal = useCloseModal();
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
      <DialogHeader
        icon={<CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-success" />}
        title="Импорт завершён"
        description={<>
          Создан проект <b>{report.root}</b>: {report.channels} каналов, {report.nodes} узлов.
        </>}
      />

      <DialogBody className="space-y-3">
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
          <Banner
            tone="warning"
            icon={AlertTriangle}
            title={`${unmapped.length} объектов не нашлось в исходниках ПЛК и разложены по общему правилу. Возможно, файлы ПЛК от другой ревизии проекта.`}
          >
            <div className="mt-2">{list(unmapped)}</div>
          </Banner>
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
      </DialogBody>

      <DialogFooter>
        <Button variant="primary" onClick={closeModal}>Понятно</Button>
      </DialogFooter>
    </>
  );
}

export function openImportReportModal(report: CdbxImportReport) {
  useModalStore.getState().openModal(<ImportReportContent report={report} />, {size: "lg"});
}
