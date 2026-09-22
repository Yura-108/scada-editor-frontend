"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {CheckCircle2} from "lucide-react";
import {useModalStore} from "@/store/modalStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {Collapsible} from "@/components/ui/codeModalParts";
import type {DeviceLayoutReport} from "@/lib/editor/deviceLayoutImport";

/**
 * Итог импорта плана устройств. Показывается только когда есть о чём сказать:
 * чистый прогон обходится тостом, иначе диалог пришлось бы закрывать каждый раз.
 */
function DeviceImportReportContent({report}: {report: DeviceLayoutReport}) {
  const closeModal = useModalStore((s) => s.closeModal);
  const skipped = report.devices - report.placed;

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        Импорт плана устройств
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Поставлено устройств: <b>{report.placed}</b> из {report.devices}
        {report.lines > 0 && <>, линий: <b>{report.lines}</b></>}.
      </Dialog.Description>

      <div className="space-y-3">
        {report.missing.length > 0 && (
          <Collapsible
            title={`Шаблон не найден: ${skipped} устройств`}
            badge={<span className="text-xs text-amber-600 dark:text-amber-400">нет в палитре</span>}
          >
            <ul className="max-h-48 overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-400">
              {report.missing.map((m) => (
                <li key={m.template}>
                  <span className="font-mono font-semibold">{m.template}</span>
                  {" — "}
                  {m.count} шт.:{" "}
                  <span className="font-mono">{m.names.join(", ")}</span>
                </li>
              ))}
            </ul>
          </Collapsible>
        )}

        {report.ambiguous.length > 0 && (
          <Collapsible
            title={`Имя шаблона неоднозначно: ${report.ambiguous.length}`}
            badge={<span className="text-xs text-gray-500">в палитре несколько, взят первый</span>}
          >
            <ul className="max-h-48 overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-400 font-mono">
              {report.ambiguous.map((a) => (
                <li key={a.template}>{a.template} — {a.count} шт.</li>
              ))}
            </ul>
          </Collapsible>
        )}

        {report.missing.length > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Чтобы эти устройства встали на схему, сохраните компонент с таким именем в
            палитру и повторите импорт.
          </p>
        )}
      </div>

      <ModalFooter>
        <Button variant="primary" onClick={closeModal}>Понятно</Button>
      </ModalFooter>
    </>
  );
}

export function openDeviceImportReportModal(report: DeviceLayoutReport) {
  useModalStore.getState().openModal(<DeviceImportReportContent report={report} />);
}
