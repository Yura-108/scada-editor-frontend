"use client";

import React, {useState} from "react";
import Link from "next/link";
import {CircleAlert} from "lucide-react";
import {toast} from "sonner";
import {Banner} from "@/shared/ui/Banner";
import {FloatingHelp} from "@/shared/ui/FloatingHelp";
import {Spinner} from "@/shared/ui/Spinner";
import {Tabs} from "@/shared/ui/Tabs";
import {UnsavedNotice} from "@/shared/ui/UnsavedNotice";
import {PageFrame} from "@/shared/ui/page/PageFrame";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {useBeforeUnloadWarning, useUnsavedGuard} from "@/shared/lib/unsavedGuard";
import {ReadOnlyBanner, useCurrentProjectGrant} from "@/core/access";
import {type EditorProject, ProjectPlaceholder, ProjectSelect} from "@/core/project";
import {useTablesDocument} from "../model/useTablesDocument";
import {useVariablesDocument} from "../model/useVariablesDocument";
import {DATA_HELP, type DataTab} from "./dataHelp";
import {DataHeaderActions} from "./DataHeaderActions";
import {DataTabContent} from "./DataTabContent";

/**
 * Данные проекта: таблицы, которые серверные скрипты читают через data(), и переменные проекта.
 *
 * Это два разных документа с отдельными версиями: таблицы — `…/data`, переменные едут в наборе
 * automation (`…/automation`) вместе с задачами и watchdog. Поэтому черновиков тоже два, и
 * «Сохранить» сохраняет документ активной вкладки. Логики здесь нет — только правка и сохранение.
 *
 * Проект выбирает страница (`app/(app)/data`): он живёт в сторе редактора, а модуль его не знает.
 */
export function DataPage({projectList, project, unavailable, listLoaded, onSelectProject}: {
  projectList: EditorProject[];
  project: EditorProject | null;
  unavailable: EditorProject | null;
  listLoaded: boolean;
  onSelectProject: (project: EditorProject | null) => void;
}) {
  // Сохранять и отправлять на исполнение — только с правом правки (403 NO_EDIT).
  const canWrite = useCurrentProjectGrant().edit;
  const [tab, setTab] = useState<DataTab>("tables");
  const [saving, setSaving] = useState(false);

  const projectId = project?.id ?? null;
  const tables = useTablesDocument(projectId, tab === "history");
  const variables = useVariablesDocument(projectId);
  const {data, dirty: dataDirty, errors: dataErrors, invalidCells} = tables;
  const {automation, dirty: automationDirty, errors: automationErrors} = variables;

  const onVariablesTab = tab === "variables";
  const loaded = onVariablesTab ? automation !== null : data !== null;
  const dirty = onVariablesTab ? automationDirty : dataDirty;
  const version = onVariablesTab ? automation?.version : data?.version;

  const switchProject = async (id: number) => {
    if ((dataDirty || automationDirty) && !(await confirmModal({
      title: "Сменить проект?",
      description: "Несохранённые правки таблиц и переменных пропадут.",
      confirmLabel: "Сменить",
      danger: true,
    }))) return;
    onSelectProject(projectList.find(p => p.id === id) ?? null);
  };

  /** Плашка внизу сохраняет всё несохранённое, а не только документ открытой вкладки. */
  const handleSaveAll = async (): Promise<boolean> => {
    // Неверные ячейки сохранить нельзя — это не «сохранилось».
    if (dataDirty && invalidCells > 0) {
      toast.error(`Есть ячейки с неверным значением: ${invalidCells}`);
      return false;
    }
    setSaving(true);
    try {
      const tablesOk = dataDirty ? await tables.save() : true;
      const variablesOk = automationDirty ? await variables.save() : true;
      return tablesOk && variablesOk;
    } finally {
      setSaving(false);
    }
  };

  useUnsavedGuard("data", {
    label: () => [dataDirty && "таблицы", automationDirty && "переменные проекта"].filter(Boolean).join(", "),
    isDirty: () => canWrite && (dataDirty || automationDirty),
    save: handleSaveAll,
  });

  const handleDiscardAll = async () => {
    const ok = await confirmModal({
      title: "Отменить несохранённые изменения?",
      description: "Таблицы и переменные перечитаются с сервера, ваши правки пропадут.",
      confirmLabel: "Отменить изменения",
      danger: true,
    });
    if (!ok) return;
    if (dataDirty) await tables.reload();
    if (automationDirty) await variables.reload();
  };

  // Уход со страницы молча выбросил бы правки.
  const anyDirty = dataDirty || automationDirty;
  useBeforeUnloadWarning(anyDirty && canWrite);

  const handleSave = async () => {
    setSaving(true);
    try {
      await (onVariablesTab ? variables.save() : tables.save());
    } finally {
      setSaving(false);
    }
  };

  // Нарушения таблиц уровня набора (предел 1 МБ, таблица без имени) — баннером.
  const dataBanner = dataErrors.filter(e => e.table === null || e.field === "tables");
  // Нарушения набора automation, не относящиеся к переменным, здесь не исправить.
  const automationBanner = automationErrors.filter(e => !e.field.startsWith("variables"));
  const banner = onVariablesTab
    ? automationBanner.map(e => `${e.task ? `${e.task} · ` : ""}${e.field}: ${e.message}`)
    : dataBanner.map(e => `${e.field}: ${e.message}`);

  return (
    <PageFrame>
      <PageHeader
        title="Данные проекта"
        actions={
          <DataHeaderActions
            onVariablesTab={onVariablesTab}
            tablesTab={tab === "tables"}
            loaded={loaded}
            version={version}
            canWrite={canWrite}
            canRemoveTable={!!data && data.tables.length > 0}
            tablesLoaded={!!data}
            tablesDirty={dataDirty}
            dirty={dirty}
            saving={saving}
            invalidCells={invalidCells}
            onReload={() => void (onVariablesTab ? variables.reload() : tables.reload())}
            onRemoveTable={() => void tables.removeSelectedTable()}
            onApply={() => void tables.apply()}
            onSave={() => void handleSave()}
          />
        }
      >
        <ProjectSelect projects={projectList} value={projectId} onChange={id => void switchProject(id)} />
        <Tabs aria-label="Разделы данных проекта" value={tab} onValueChange={setTab} items={[
          {value: "tables", label: "Таблицы", dirty: dataDirty},
          {value: "variables", label: "Переменные", dirty: automationDirty},
          {value: "history", label: "История таблиц"},
        ]} />
      </PageHeader>

      {project && loaded && !canWrite && <ReadOnlyBanner projectName={project.name} />}

      {banner.length > 0 && (
        <Banner layout="bar" tone="destructive" icon={CircleAlert}>
          {banner.map((line, i) => <div key={i}>{line}</div>)}
          {onVariablesTab && (
            <div>Эти нарушения исправляются на странице <Link href="/automation" className="underline">«Автоматизация»</Link>.</div>
          )}
        </Banner>
      )}

      {projectId == null ? (
        <ProjectPlaceholder listLoaded={listLoaded} projectCount={projectList.length} unavailable={unavailable} />
      ) : !loaded ? (
        <Spinner label="Загрузка…" fill />
      ) : (
        <DataTabContent tab={tab} projectId={projectId} canWrite={canWrite} tables={tables} variables={variables} />
      )}

      {canWrite && anyDirty && (
        <UnsavedNotice
          details={[dataDirty && "таблицы", automationDirty && "переменные"].filter(Boolean).join(", ")}
          onSave={() => void handleSaveAll()}
          onDiscard={() => void handleDiscardAll()}
          saving={saving}
          saveBlockedReason={dataDirty && invalidCells > 0 ? `Есть ячейки с неверным значением: ${invalidCells}` : null}
        />
      )}
      {loaded && <FloatingHelp storageKey="help.data" title={DATA_HELP[tab].title}>{DATA_HELP[tab].body}</FloatingHelp>}
    </PageFrame>
  );
}
