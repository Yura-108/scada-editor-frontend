"use client";

import React, {useEffect, useId, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {AlertTriangle, CheckCircle2, Link2} from "lucide-react";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {Collapsible} from "@/components/ui/codeModalParts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {AutobindMiss, AutobindReport} from "@/types/autobind.types";

const labelClass = "text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider";

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
          <span className={labelClass}>Изменённые схемы</span>
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
  const closeModal = useModalStore((s) => s.closeModal);
  const autobindProject = useEditorStore((s) => s.autobindProject);

  const [sites, setSites] = useState<string[]>([]);
  const [site, setSite] = useState("");
  const [roots, setRoots] = useState<string[]>([]);
  const [root, setRoot] = useState("");
  const [isLoadingRoots, setIsLoadingRoots] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [report, setReport] = useState<AutobindReport | null>(null);

  const siteField = useId();
  const rootField = useId();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/device/site/");
        if (!res.ok) return;
        const data: unknown = await res.json();
        setSites(Array.isArray(data) ? data.filter((s): s is string => typeof s === "string") : []);
      } catch (err) {
        console.error("Не удалось загрузить площадки:", err);
      }
    })();
  }, []);

  // Список баз перезапрашивается на каждую смену площадки. `cancelled` — защита от гонки:
  // ответ по прежней площадке не должен перетереть свежий (тот же приём в StartMenu).
  useEffect(() => {
    if (!site) {
      setRoots([]);
      setRoot("");
      return;
    }
    let cancelled = false;
    setIsLoadingRoots(true);
    void (async () => {
      try {
        const res = await fetch(`/api/device/hierarchy?site=${encodeURIComponent(site)}`);
        if (!res.ok) throw new Error(`Ошибка ${res.status}`);
        const data = await res.json() as {nodes?: {key: string}[]};
        if (cancelled) return;
        setRoots((data.nodes ?? []).map((n) => n.key));
        setRoot("");
      } catch (err) {
        if (!cancelled) console.error("Не удалось загрузить базы каналов:", err);
      } finally {
        if (!cancelled) setIsLoadingRoots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [site]);

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
      <Dialog.Title className="text-xl font-semibold mb-1 flex items-center gap-2">
        {report
          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          : <Link2 className="h-5 w-5 text-indigo-500" />}
        Автопривязка к базе каналов
      </Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Проект <b>{projectName}</b>. Теговые свойства получат пути из базы: имя компонента —
        объект, имя свойства — поле.
      </Dialog.Description>

      {report ? (
        <AutobindReportView report={report} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor={siteField} className={labelClass}>Площадка</label>
              <Select value={site} onValueChange={setSite}>
                <SelectTrigger id={siteField} className="h-12">
                  <SelectValue placeholder="Выберите площадку…" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor={rootField} className={labelClass}>База каналов</label>
              <Select value={root} onValueChange={setRoot} disabled={!site || isLoadingRoots}>
                <SelectTrigger id={rootField} className="h-12">
                  <SelectValue placeholder={isLoadingRoots ? "Загрузка…" : "Выберите базу…"} />
                </SelectTrigger>
                <SelectContent>
                  {/* Подпись — последний сегмент, значение — полный путь: именно он уезжает
                      в `channel_root`. */}
                  {roots.map((key) => (
                    <SelectItem key={key} value={key}>{key.split(".").pop() || key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {site && !isLoadingRoots && roots.length === 0 && (
                <p className="text-xs text-gray-500 ml-1">На этой площадке баз нет</p>
              )}
            </div>
          </div>

          <p className={cn(
            "flex items-start gap-2 rounded-xl p-3 text-sm",
            "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
          )}>
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Совпавшие теги будут перезаписаны, даже если уже заданы. Отменить — восстановлением
            предыдущей версии схемы.
          </p>
        </div>
      )}

      <ModalFooter>
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
      </ModalFooter>
    </>
  );
}

export function openAutobindModal(projectId: number, projectName: string) {
  useModalStore.getState().openModal(
    <AutobindContent projectId={projectId} projectName={projectName} />,
  );
}
