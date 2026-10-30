"use client";

import React, {useCallback, useEffect, useState} from "react";
import Link from "next/link";
import {CircleAlert, RefreshCw, Save, Trash2, Upload} from "lucide-react";
import {toast} from "sonner";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import {Spinner} from "@/shared/ui/Spinner";
import {Tabs} from "@/shared/ui/Tabs";
import {PageFrame} from "@/shared/ui/page/PageFrame";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {useEditorStore, useEditableProject} from "@/modules/editor";
import {useCurrentProjectGrant} from "@/core/access";
import {ProjectPlaceholder} from "@/components/ui/ProjectPlaceholder";
import {ReadOnlyBanner} from "@/components/ui/ReadOnlyBanner";
import {AutomationSaveError, fetchAutomation, saveAutomation} from "@/core/automation";
import {
  confirmRemoveTable, DataDiffView, DataVersionChanges, diffDataVersions, fetchProjectData,
  fetchProjectDataVersions, loadDataVersion, ProjectDataSaveError, reloadProjectData,
  restoreProjectDataVersion, saveProjectData, TablesEditor, VariablesEditor,
} from "@/modules/data";
import {UnsavedNotice} from "@/shared/ui/UnsavedNotice";
import {FloatingHelp} from "@/shared/ui/FloatingHelp";
import {useUnsavedGuard} from "@/lib/unsavedGuard";
import {VersionHistoryList} from "@/shared/ui/VersionHistoryList";
import type {AutomationSet, AutomationValidationError} from "@/types/automation.types";
import type {ProjectDataSet, ProjectDataValidationError} from "@/types/projectData.types";
import type {VersionSummary} from "@/types/editorVersion.types";
import {ProjectSelect} from "@/core/project";

type Tab = "tables" | "variables" | "history";


/** Справка раздела: по вкладке — своя инструкция. */
const HELP: Record<Tab, {title: string; body: React.ReactNode}> = {
  tables: {
    title: "Таблицы данных проекта",
    body: <>
      <p>
        Таблица — справочник для серверных скриптов (задач автоматизации и скриптов монитора):
        уставки, рецептуры, коэффициенты. Скрипт читает её так: <code>data(&apos;имя&apos;)</code> —
        вся таблица, <code>data(&apos;имя&apos;, &apos;ключ&apos;)</code> — одна строка.
      </p>
      <ul>
        <li><b>Имя таблицы</b> — по нему таблицу находят скрипты. Только латиница, цифры и _.</li>
        <li><b>Заголовок</b> и <b>Описание</b> — для людей: название в списке слева и заметка. На скрипты не влияют.</li>
        <li>
          <b>Колонки</b> задают, из чего состоит строка: имя для скриптов, заголовок для людей, тип значения.
          «Обязательна» — в каждой строке должно быть значение (или значение по умолчанию).
        </li>
        <li><b>Строки</b> — сами данные. key — уникальный ключ строки.</li>
        <li>
          «Сохранить» записывает таблицы на сервер новой версией. Чтобы работающие задачи увидели
          изменения, нажмите «Применить данные».
        </li>
        <li>Удаление таблицы тоже применяется только при сохранении.</li>
      </ul>
    </>,
  },
  variables: {
    title: "Переменные проекта",
    body: <>
      <p>
        Переменная — именованное значение, общее для всего проекта. Задачи пишут её через{" "}
        <code>setVar(имя, значение)</code> и читают через <code>vars.имя</code>, а в мнемосхеме её
        можно привязать к элементу как <code>@var.имя</code>.
      </p>
      <ul>
        <li>Тип и значение по умолчанию задаются здесь.</li>
        <li>Отметки «пишет» показывают, какие задачи меняют переменную.</li>
        <li>Переменные хранятся вместе с задачами автоматизации и сохраняются в их версии.</li>
      </ul>
    </>,
  },
  history: {
    title: "История таблиц",
    body: <ul>
      <li>Каждое сохранение таблиц — отдельная версия: кто и когда её сделал.</li>
      <li>«Подробнее» показывает, что изменилось относительно предыдущей версии, и таблицы версии целиком.</li>
      <li>«Восстановить…» сначала показывает, что изменится, и только потом возвращает таблицы к выбранной версии.</li>
    </ul>,
  },
};

/**
 * Данные проекта: таблицы, которые серверные скрипты читают через data(), и переменные проекта.
 *
 * Это два разных документа с отдельными версиями: таблицы — `…/data`, переменные едут в наборе
 * automation (`…/automation`) вместе с задачами и watchdog. Поэтому черновиков тоже два, и
 * «Сохранить» сохраняет документ активной вкладки. Логики здесь нет — только правка и сохранение.
 */
export default function DataClient() {
  // Страница читает черновик проекта — нужен «просмотр» или «правка». Проект, выбранный в
  // мониторе только с «управлением», сюда не попадает: его данных раздел не показывает.
  const {projectList, project, unavailable, listLoaded} = useEditableProject();
  // Сохранять и отправлять на исполнение — только с правом правки (403 NO_EDIT).
  const canWrite = useCurrentProjectGrant().edit;
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);

  const [tab, setTab] = useState<Tab>("tables");
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<ProjectDataSet | null>(null);
  const [dataDirty, setDataDirty] = useState(false);
  const [dataErrors, setDataErrors] = useState<ProjectDataValidationError[]>([]);
  const [invalidCells, setInvalidCells] = useState(0);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState(0);

  const [automation, setAutomation] = useState<AutomationSet | null>(null);
  const [automationDirty, setAutomationDirty] = useState(false);
  const [automationErrors, setAutomationErrors] = useState<AutomationValidationError[]>([]);

  const projectId = project?.id ?? null;

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

  /** `true` — сохранилось: охране ухода надо знать, можно ли уходить. */
  const saveTables = async (): Promise<boolean> => {
    if (!data || projectId == null) return false;
    try {
      const saved = await saveProjectData(projectId, data.version, data.tables);
      setData(saved);
      setDataDirty(false);
      setDataErrors([]);
      toast.success(`Таблицы сохранены, версия ${saved.version}. Чтобы задачи увидели правку, нажмите «Применить данные»`);
      return true;
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
      return false;
    }
  };

  const saveVariables = async (): Promise<boolean> => {
    if (!automation || projectId == null) return false;
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
      return true;
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
      return false;
    }
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
      const tablesOk = dataDirty ? await saveTables() : true;
      const variablesOk = automationDirty ? await saveVariables() : true;
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
    if (dataDirty) await reloadData();
    if (automationDirty) await reloadAutomation();
  };

  const handleRemoveTable = async () => {
    if (!data) return;
    const tables = await confirmRemoveTable(data.tables, selectedTable);
    if (!tables) return;
    setData(d => (d ? {...d, tables} : d));
    setDataDirty(true);
  };

  // Уход со страницы молча выбросил бы правки.
  const anyDirty = dataDirty || automationDirty;
  useEffect(() => {
    if (!anyDirty || !canWrite) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty, canWrite]);

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
    if (projectId == null || !data) return;
    // Что именно поменяется — до подтверждения: номер версии сам по себе ничего не говорит.
    let preview: React.ReactNode;
    try {
      const target = await loadDataVersion(projectId, versionNo);
      preview = target
        ? <DataDiffView diff={diffDataVersions(data.tables, target)} wording="restore" />
        : <p className="text-xs text-neutral-500">Содержимое версии не удалось разобрать.</p>;
    } catch (err) {
      preview = <p className="text-xs text-red-600">{(err as Error).message}</p>;
    }
    const ok = await confirmModal({
      title: `Восстановить версию таблиц ${versionNo}?`,
      description: <div className="space-y-3">
        <p>
          Таблицы заменятся содержимым v{versionNo}; восстановление запишется новой версией.
          Чтобы задачи automation увидели откат, нажмите «Применить данные».
        </p>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1.5">Что изменится по сравнению с текущей v{data.version}</p>
          <div className="max-h-[40vh] overflow-y-auto">{preview}</div>
        </div>
      </div>,
      confirmLabel: "Восстановить",
      danger: true,
      wide: true,
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
    <PageFrame>
      <PageHeader
        title="Данные проекта"
        actions={<>
          {loaded && version != null && (
            <span className="text-xs text-muted-foreground" title={onVariablesTab ? "Версия набора автоматизации" : "Версия таблиц"}>v{version}</span>
          )}
          <IconButton icon={RefreshCw} label="Перечитать с сервера" variant="secondary" disabled={!loaded}
            onClick={() => void (onVariablesTab ? reloadAutomation() : reloadData())} />
          {canWrite && tab === "tables" && data && data.tables.length > 0 && (
            <Button
              size="sm"
              className="text-destructive"
              onClick={() => void handleRemoveTable()}
              title="Удалить выбранную таблицу (применится при сохранении)"
            >
              <Trash2 size={14} />Удалить таблицу
            </Button>
          )}
          {canWrite ? <>
            <Button
              size="sm"
              onClick={() => void handleApply()}
              disabled={!data || dataDirty}
              title={dataDirty ? "Сначала сохраните таблицы" : "Попросить automation перечитать сохранённые данные"}
            >
              <Upload size={14} />Применить данные
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!loaded || !dirty || saving || (!onVariablesTab && invalidCells > 0)}
              title={!onVariablesTab && invalidCells > 0 ? "Исправьте ячейки с неверным значением" : undefined}
            >
              <Save size={14} />{saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </> : null}
        </>}
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
      ) : tab === "tables" ? (
        <TablesEditor
          tables={data!.tables}
          errors={dataErrors}
          onChange={tables => { setData(d => (d ? {...d, tables} : d)); setDataDirty(true); }}
          onInvalidCountChange={setInvalidCells}
          selected={selectedTable}
          onSelect={setSelectedTable}
          readOnly={!canWrite}
        />
      ) : tab === "variables" ? (
        <fieldset disabled={!canWrite} className="flex-1 min-h-0 min-w-0 m-0 p-0 border-0 overflow-y-auto pb-24">
          <VariablesEditor
            variables={automation!.variables}
            tasks={automation!.tasks}
            errors={automationErrors.filter(e => e.field.startsWith("variables"))}
            onChange={(variables, tasks) => { setAutomation(a => (a ? {...a, variables, tasks} : a)); setAutomationDirty(true); }}
          />
        </fieldset>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pb-24">
          <VersionHistoryList
            versions={versions}
            currentVersion={data!.version}
            dirty={dataDirty}
            onRestore={canWrite ? v => void handleRestore(v) : undefined}
            renderDetails={(v, previous) => projectId != null && (
              <DataVersionChanges
                projectId={projectId}
                versionNo={v.version_no}
                previousNo={previous?.version_no ?? (v.version_no > 1 ? v.version_no - 1 : null)}
              />
            )}
          />
        </div>
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
      {loaded && <FloatingHelp storageKey="help.data" title={HELP[tab].title}>{HELP[tab].body}</FloatingHelp>}
    </PageFrame>
  );
}
