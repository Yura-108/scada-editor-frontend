"use client";

import React, {useCallback, useEffect, useState} from "react";
import Link from "next/link";
import {RefreshCw, Save, Upload} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useEditorStore} from "@/store/useEditorStore";
import {AutomationSaveError, fetchAutomation, saveAutomation} from "@/lib/automation/automationApi";
import {
  fetchProjectData,
  fetchProjectDataVersions,
  ProjectDataSaveError,
  reloadProjectData,
  restoreProjectDataVersion,
  saveProjectData,
} from "@/lib/projectData/projectDataApi";
import {TablesEditor} from "@/components/projectData/TablesEditor";
import {VariablesEditor} from "@/components/automation/VariablesEditor";
import {VersionHistoryList} from "@/components/automation/VersionHistoryList";
import type {AutomationSet, AutomationValidationError} from "@/types/automation.types";
import type {ProjectDataSet, ProjectDataValidationError} from "@/types/projectData.types";
import type {VersionSummary} from "@/types/editorVersion.types";

type Tab = "tables" | "variables" | "history";

const TAB_LABELS: Record<Tab, string> = {tables: "Таблицы", variables: "Переменные", history: "История таблиц"};

/**
 * Данные проекта: таблицы, которые серверные скрипты читают через data(), и переменные проекта.
 *
 * Это два разных документа с отдельными версиями: таблицы — `…/data`, переменные едут в наборе
 * automation (`…/automation`) вместе с задачами и watchdog. Поэтому черновиков тоже два, и
 * «Сохранить» сохраняет документ активной вкладки. Логики здесь нет — только правка и сохранение.
 */
export default function DataClient() {
  const projectList = useEditorStore(s => s.projectList);
  const currentProject = useEditorStore(s => s.currentProject);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);

  const [tab, setTab] = useState<Tab>("tables");
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<ProjectDataSet | null>(null);
  const [dataDirty, setDataDirty] = useState(false);
  const [dataErrors, setDataErrors] = useState<ProjectDataValidationError[]>([]);
  const [invalidCells, setInvalidCells] = useState(0);
  const [versions, setVersions] = useState<VersionSummary[]>([]);

  const [automation, setAutomation] = useState<AutomationSet | null>(null);
  const [automationDirty, setAutomationDirty] = useState(false);
  const [automationErrors, setAutomationErrors] = useState<AutomationValidationError[]>([]);

  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  const projectId = currentProject?.id ?? null;

  const reloadData = useCallback(async () => {
    setData(null);
    if (projectId == null) return;
    try {
      setData(await fetchProjectData(projectId));
      setDataDirty(false);
      setDataErrors([]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [projectId]);

  const reloadAutomation = useCallback(async () => {
    setAutomation(null);
    if (projectId == null) return;
    try {
      setAutomation(await fetchAutomation(projectId));
      setAutomationDirty(false);
      setAutomationErrors([]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    void reloadData();
    void reloadAutomation();
  }, [reloadData, reloadAutomation]);

  useEffect(() => {
    if (tab !== "history" || projectId == null) return;
    fetchProjectDataVersions(projectId).then(setVersions).catch(err => toast.error((err as Error).message));
  }, [tab, projectId, data?.version]);

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
    setCurrentProject(projectList.find(p => p.id === id) ?? null);
  };

  /** 409: слияния нет — остаётся перечитать документ, отказавшись от своих правок. */
  const offerReload = async (what: string, reload: () => Promise<void>) => {
    const ok = await confirmModal({
      title: `${what} уже изменил кто-то другой`,
      description: "Перечитать с сервера? Ваши несохранённые правки пропадут — перенесите их заново.",
      confirmLabel: "Перечитать",
      danger: true,
    });
    if (ok) await reload();
  };

  const saveTables = async () => {
    if (!data || projectId == null) return;
    try {
      const saved = await saveProjectData(projectId, data.version, data.tables);
      setData(saved);
      setDataDirty(false);
      setDataErrors([]);
      toast.success(`Таблицы сохранены, версия ${saved.version}. Чтобы задачи увидели правку, нажмите «Применить данные»`);
    } catch (err) {
      if (err instanceof ProjectDataSaveError && err.errors.length) {
        setDataErrors(err.errors);
        toast.error(`Таблицы не прошли проверку: ${err.errors.length}`);
      } else if (err instanceof ProjectDataSaveError && err.conflict) {
        toast.error(err.message);
        await offerReload("Таблицы", reloadData);
      } else {
        toast.error((err as Error).message);
      }
    }
  };

  const saveVariables = async () => {
    if (!automation || projectId == null) return;
    try {
      // Задачи и watchdog уходят как пришли (плюс writes_variables, правленные здесь): PUT — весь набор.
      const saved = await saveAutomation(projectId, {
        based_on_version: automation.version,
        tasks: automation.tasks,
        variables: automation.variables,
        watchdog: automation.watchdog,
      });
      setAutomation(saved);
      setAutomationDirty(false);
      setAutomationErrors([]);
      toast.success(`Переменные сохранены, версия набора ${saved.version}`);
    } catch (err) {
      if (err instanceof AutomationSaveError && err.errors.length) {
        setAutomationErrors(err.errors);
        toast.error(`Набор не прошёл проверку: ${err.errors.length}`);
      } else if (err instanceof AutomationSaveError && err.conflict) {
        toast.error(err.message);
        await offerReload("Набор автоматизации", reloadAutomation);
      } else {
        toast.error((err as Error).message);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await (onVariablesTab ? saveVariables() : saveTables());
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (projectId == null) return;
    try {
      const result = await reloadProjectData(projectId);
      if (result === "applied") toast.success("Данные отправлены в automation");
      else toast.info("Проект сейчас не исполняется — данные подхватятся при его запуске");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRestore = async (versionNo: number) => {
    if (projectId == null) return;
    const ok = await confirmModal({
      title: `Восстановить версию таблиц ${versionNo}?`,
      description: "Таблицы заменятся содержимым этой версии; восстановление запишется новой версией. "
        + "Чтобы задачи automation увидели откат, нажмите «Применить данные».",
      confirmLabel: "Восстановить",
      danger: true,
    });
    if (!ok) return;
    try {
      await restoreProjectDataVersion(projectId, versionNo);
      await reloadData();
      toast.success(`Версия ${versionNo} восстановлена`);
    } catch (err) {
      toast.error((err as Error).message);
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
    <div className="fixed inset-0 top-(--app-header-h) overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80">
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Данные проекта</span>
        <select
          className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-sm"
          value={projectId ?? ""}
          onChange={e => void switchProject(Number(e.target.value))}
        >
          <option value="" disabled>Проект…</option>
          {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(Object.keys(TAB_LABELS) as Tab[]).map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn("px-3 py-1 rounded-lg text-sm", tab === key ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
          >
            {TAB_LABELS[key]}
            {((key === "tables" && dataDirty) || (key === "variables" && automationDirty)) && <span className="ml-1 text-amber-500">•</span>}
          </button>
        ))}
        <div className="flex-1" />
        {loaded && (
          <span className="text-xs text-neutral-500">
            {onVariablesTab ? "набор automation" : "таблицы"}, версия {version ?? "—"}{dirty ? " · есть несохранённые правки" : ""}
          </span>
        )}
        <Button
          onClick={() => void (onVariablesTab ? reloadAutomation() : reloadData())}
          disabled={!loaded}
          title="Перечитать с сервера"
        >
          <RefreshCw size={14} />
        </Button>
        <Button
          onClick={() => void handleApply()}
          disabled={!data || dataDirty}
          title={dataDirty ? "Сначала сохраните таблицы" : "Попросить automation перечитать сохранённые данные"}
        >
          <Upload size={14} />Применить данные
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={!loaded || !dirty || saving || (!onVariablesTab && invalidCells > 0)}
          title={!onVariablesTab && invalidCells > 0 ? "Исправьте ячейки с неверным значением" : undefined}
        >
          <Save size={14} />{saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>

      {banner.length > 0 && (
        <div className="shrink-0 px-4 py-2 text-sm bg-red-500/10 text-red-700 dark:text-red-300 space-y-0.5">
          {banner.map((line, i) => <div key={i}>{line}</div>)}
          {onVariablesTab && (
            <div>Эти нарушения исправляются на странице <Link href="/automation" className="underline">«Автоматизация»</Link>.</div>
          )}
        </div>
      )}

      {projectId == null ? (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">Выберите проект</div>
      ) : !loaded ? (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">Загрузка…</div>
      ) : tab === "tables" ? (
        <TablesEditor
          tables={data!.tables}
          errors={dataErrors}
          onChange={tables => { setData(d => (d ? {...d, tables} : d)); setDataDirty(true); }}
          onInvalidCountChange={setInvalidCells}
        />
      ) : tab === "variables" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <VariablesEditor
            variables={automation!.variables}
            tasks={automation!.tasks}
            errors={automationErrors.filter(e => e.field.startsWith("variables"))}
            onChange={(variables, tasks) => { setAutomation(a => (a ? {...a, variables, tasks} : a)); setAutomationDirty(true); }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <VersionHistoryList versions={versions} currentVersion={data!.version} dirty={dataDirty} onRestore={v => void handleRestore(v)} />
        </div>
      )}
    </div>
  );
}
