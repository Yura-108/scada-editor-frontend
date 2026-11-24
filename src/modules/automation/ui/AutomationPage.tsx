"use client";

import React, {useMemo, useState} from "react";
import Link from "next/link";
import {CircleAlert} from "lucide-react";
import {Banner} from "@/shared/ui/Banner";
import {FloatingHelp} from "@/shared/ui/FloatingHelp";
import {Spinner} from "@/shared/ui/Spinner";
import {Tabs} from "@/shared/ui/Tabs";
import {UnsavedNotice} from "@/shared/ui/UnsavedNotice";
import {PageFrame} from "@/shared/ui/page/PageFrame";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {confirmLeave, useBeforeUnloadWarning, useUnsavedGuard} from "@/shared/lib/unsavedGuard";
import {ReadOnlyBanner, useCurrentProjectGrant} from "@/core/access";
import {type EditorProject, ProjectPlaceholder, ProjectSelect} from "@/core/project";
import {sameWatchdog, taskDraftState} from "../lib/automationDraft";
import {useAutomationDocument} from "../model/useAutomationDocument";
import {useTaskActions} from "../model/useTaskActions";
import {AUTOMATION_HELP, AUTOMATION_TABS, type AutomationTab} from "./automationHelp";
import {AutomationHeaderActions} from "./AutomationHeaderActions";
import {AutomationTabContent} from "./AutomationTabContent";

/**
 * Редактор фоновых задач проекта. Бэкенд принимает набор только целиком (задачи, переменные,
 * watchdog), но сохранять можно и по одной задаче: тогда на сервер уходит *сохранённый* набор
 * с заменённой задачей, а незаконченные правки соседних остаются черновиком. Удаление задачи
 * сохраняется сразу, после подтверждения, и его можно вернуть из уведомления или из «Истории».
 * Переменные правятся в разделе «Данные проекта», здесь они только едут в наборе нетронутыми.
 * Исполняет задачи сервис automation — страница нужна только для правки определений.
 *
 * Проект выбирает страница (`app/(app)/automation`): он живёт в сторе редактора, а модуль его не знает.
 */
export function AutomationPage({projectList, project, unavailable, listLoaded, onSelectProject}: {
  projectList: EditorProject[];
  project: EditorProject | null;
  unavailable: EditorProject | null;
  listLoaded: boolean;
  onSelectProject: (project: EditorProject | null) => void;
}) {
  // Сохранять и отправлять на исполнение — только с правом правки (403 NO_EDIT).
  const canWrite = useCurrentProjectGrant().edit;
  const [tab, setTab] = useState<AutomationTab>("tasks");
  const projectId = project?.id ?? null;
  const doc = useAutomationDocument(projectId, tab);
  const actions = useTaskActions(doc, setTab);
  const {saved, draft, saving, errors, dirty} = doc;

  useUnsavedGuard("automation", {
    label: () => "задачи автоматизации",
    isDirty: () => canWrite && dirty,
    save: doc.saveAll,
  });

  // Перезагрузка страницы молча выбросила бы черновик.
  useBeforeUnloadWarning(dirty && canWrite);

  // Бэкенд обрезает пробелы в имени задачи и в errors[].task присылает уже обрезанное.
  const taskErrors = (name: string) => errors.filter(e => e.task === name.trim());
  // watchdog.tag, занятый выходом задачи, приходит с именем этой задачи — показываем его и на вкладке watchdog.
  const projectErrors = useMemo(
    () => errors.filter(e => e.task === null || e.field.startsWith("watchdog")),
    [errors],
  );
  const hasVariableErrors = projectErrors.some(e => e.field.startsWith("variables"));
  const unsavedCount = draft && saved
    ? draft.tasks.filter(t => taskDraftState(t, saved) !== "saved").length
      + (sameWatchdog(draft.watchdog, saved.watchdog) ? 0 : 1)
    : 0;

  return (
    <PageFrame>
      <PageHeader
        title="Автоматизация"
        actions={<AutomationHeaderActions doc={doc} canWrite={canWrite} unsavedCount={unsavedCount} />}
      >
        <ProjectSelect
          projects={projectList}
          value={projectId}
          onChange={async id => {
            const next = projectList.find(p => p.id === id) ?? null;
            // Черновик набора принадлежит проекту: смена проекта его выбрасывает.
            if (await confirmLeave()) onSelectProject(next);
          }}
        />
        <Tabs aria-label="Разделы автоматизации" value={tab} onValueChange={setTab} items={AUTOMATION_TABS} />
      </PageHeader>

      {project && draft && !canWrite && <ReadOnlyBanner projectName={project.name} />}

      {/* Полосой под шапкой, а не в левом нижнем углу: там она закрывала начало редактора
          скрипта задачи (#19 п. 5). */}
      {canWrite && dirty && (
        <UnsavedNotice
          layout="bar"
          details={unsavedCount > 0 ? `Не сохранено изменений: ${unsavedCount}. Задачу можно сохранить отдельно — кнопкой в её редакторе.` : undefined}
          onSave={() => void doc.saveAll()}
          onDiscard={() => void doc.reload()}
          saving={saving}
        />
      )}

      {projectErrors.length > 0 && (
        <Banner layout="bar" tone="destructive" icon={CircleAlert}>
          {projectErrors.map((e, i) => <div key={i}>{e.field}: {e.message}</div>)}
          {hasVariableErrors && (
            <div>
              Переменные правятся в разделе{" "}
              <Link href="/data" className="underline">«Данные проекта» → «Переменные»</Link>.
            </div>
          )}
        </Banner>
      )}

      {!draft || !saved || projectId == null ? (
        projectId == null
          ? <ProjectPlaceholder listLoaded={listLoaded} projectCount={projectList.length} unavailable={unavailable} />
          : <Spinner label="Загрузка…" fill />
      ) : (
        <AutomationTabContent
          tab={tab}
          projectId={projectId}
          canWrite={canWrite}
          doc={doc}
          actions={actions}
          taskErrors={taskErrors}
          projectErrors={projectErrors}
        />
      )}

      {draft && <FloatingHelp storageKey="help.automation" title={AUTOMATION_HELP[tab].title} more={AUTOMATION_HELP[tab].more}>{AUTOMATION_HELP[tab].body}</FloatingHelp>}
    </PageFrame>
  );
}
