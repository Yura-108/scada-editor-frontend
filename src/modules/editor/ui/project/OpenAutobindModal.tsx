"use client";

import React, {useState} from "react";
import {AlertTriangle, CheckCircle2, Link2} from "lucide-react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {useEditorStore} from "../../model/editorStore";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {fieldLabelClass} from "@/shared/ui/field/fieldStyles";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {Collapsible} from "@/shared/ui/codeModalParts";
import type {AutobindMiss, AutobindReport} from "../../types/autobind.types";
import {useChannelRoot} from "./useChannelRoot";
import {ChannelRootPicker} from "./ChannelRootPicker";

/** Строки несовпадений: имя компонента, свойство (у `not_found` его нет) и сцена. */
function MissList({items}: {items: AutobindMiss[]}) {
  return (
    <ul className="max-h-48 overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-400">
      {items.map((miss, i) => (
        // Ключ с индексом: один компонент попадает в список по разу на каждое своё свойство.
        <li key={`${miss.component_id}-${miss.property ?? ""}-${i}`}>
          <span className="font-mono font-semibold">{miss.name}</span>
          {miss.property && <> · <span className="font-mono">{miss.property}</span></>}
          {" — "}
          <span className="text-gray-500">{miss.scene}</span>
        </li>
      ))}
    </ul>
  );
}

function AutobindReportView({report}: {report: AutobindReport}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Привязано свойств: <b>{report.bound}</b>, изменено: <b>{report.changed}</b>.
      </p>

      {report.scenes.length > 0 ? (
        <div className="space-y-1">
          <span className={fieldLabelClass}>Изменённые схемы</span>
          <ul className="space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
            {report.scenes.map((s) => (
              <li key={s.scene_id}>
                {s.name} — версия {s.version_no}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ничего не поменялось: теги уже соответствовали базе.
        </p>
      )}

      {report.not_found.length > 0 && (
        <Collapsible
          title={`Объект не найден: ${report.not_found.length}`}
          badge={<span className="text-xs text-gray-500">теги этих компонентов не тронуты</span>}
        >
          <p className="text-xs text-gray-500 mb-2">
            В базе нет объекта с таким именем — либо старое имя («Имя в ПЛК») указывает сразу
            на несколько объектов, и выбрать однозначно нельзя.
          </p>
          <MissList items={report.not_found} />
        </Collapsible>
      )}

      {report.missing_fields.length > 0 && (
        <Collapsible
          title={`Нет поля у объекта: ${report.missing_fields.length}`}
          badge={<span className="text-xs text-amber-600 dark:text-amber-400">проверьте имя свойства</span>}
        >
          <MissList items={report.missing_fields} />
        </Collapsible>
      )}

      {report.in_operation && (
        <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Проект в эксплуатации — новые теги подхватятся после повторного подъёма.
        </p>
      )}
    </div>
  );
}

function AutobindContent({projectId, projectName}: {projectId: number; projectName: string}) {
  const closeModal = useCloseModal();
  const autobindProject = useEditorStore((s) => s.autobindProject);

  const channelRoot = useChannelRoot();
  const {root} = channelRoot;
  const [isBinding, setIsBinding] = useState(false);
  const [report, setReport] = useState<AutobindReport | null>(null);

  const handleBind = async () => {
    if (!root) return;
    setIsBinding(true);
    try {
      const result = await autobindProject(projectId, root);
      // `null` — отказ от сохранения или ошибка: тост уже показан действием, форму оставляем.
      if (result) setReport(result);
    } finally {
      setIsBinding(false);
    }
  };

  return (
    <>
      <DialogHeader
        icon={report
          ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-success" />
          : <Link2 className="mt-1 h-5 w-5 shrink-0 text-primary" />}
        title="Автопривязка к базе каналов"
        description={<>
          Проект <b>{projectName}</b>. Теговые свойства получат пути из базы: имя компонента —
          объект, имя свойства — поле.
        </>}
      />

      <DialogBody>
        {report ? (
          <AutobindReportView report={report} />
        ) : (
          <div className="space-y-5">
            <ChannelRootPicker state={channelRoot} />

            <Banner role="note" tone="warning" icon={AlertTriangle}>
              Совпавшие теги будут перезаписаны, даже если уже заданы. Отменить — восстановлением
              предыдущей версии схемы.
            </Banner>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>{report ? "Закрыть" : "Отмена"}</Button>
        {!report && (
          <Button
            variant="primary"
            onClick={() => void handleBind()}
            disabled={!root || isBinding}
          >
            <Link2 size={16} />
            {isBinding ? "Привязываю…" : "Привязать"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

/**
 * Автопривязка — из выбора проекта в шапке редактора; поверх открытого окна, если оно есть.
 */
export function openAutobindModal(projectId: number, projectName: string) {
  useModalStore.getState().pushModal(
    <AutobindContent projectId={projectId} projectName={projectName} />,
    {size: "lg", closeOnOverlay: false},
  );
}
