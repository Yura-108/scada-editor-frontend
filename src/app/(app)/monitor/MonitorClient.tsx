"use client";

import React, {useEffect, useState} from "react";
import {History, Radio} from "lucide-react";
import {
  ArchivePlayerBar, AutomationTaskPanel, FloatingWindowsLayer, MonitorActions, MonitorStatusBadges,
  NoReleaseNotice, ProcedureHud, ProcedurePanel, registerMonitorDialogs, RejectedNotice,
  useArchiveReplay, useMonitorMode, useMonitorWindows, useProcedureSync, useRuntimeEngine,
} from "@/modules/monitor";
import {Canvas, useEditorStore, SceneTabs} from "@/modules/editor";
import {ProjectSelect} from "@/core/project";
import {Select} from "@/shared/ui/field/Select";
import {PageFrame} from "@/shared/ui/page/PageFrame";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {EmptyState} from "@/shared/ui/EmptyState";
import {SegmentedControl} from "@/shared/ui/SegmentedControl";
import {useMonitorRevoked, useMonitorSession} from "./useMonitorSession";

// Окна монитора для меню элемента на холсте.
registerMonitorDialogs();

/** Вкладка выполнения процедур. Не схема — у неё нет `sceneId`, как у «Рецептов» в редакторе. */
const PROCEDURES_TAB = {key: "procedures", label: "Процедуры"} as const;

/**
 * Режим монитора: read-only просмотр сцены с живыми данными.
 * Сцена рендерится тем же Canvas, но с readOnly (фигуры вне hit-графа Konva);
 * движок биндингов (useRuntimeEngine) держит рантайм-сессию и применяет
 * интенты только в рантайм-карты стора — elements/undo/автосейв не затронуты
 * (автосейв здесь и не смонтирован — он живёт только в EditorClient).
 */
export default function MonitorClient() {
  const projectList = useEditorStore(s => s.projectList);
  const currentProject = useEditorStore(s => s.currentProject);
  const sceneList = useEditorStore(s => s.sceneList);
  const scene = useEditorStore(s => s.scene);
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);
  const loadScene = useEditorStore(s => s.loadScene);
  const runtimeFlags = useEditorStore(s => s.projectRuntimeFlags);
  const releaseVersionNo = useEditorStore(s => s.releaseVersionNo);
  const releaseError = useEditorStore(s => s.releaseError);

  useMonitorSession();

  const projectKey = currentProject?.id ?? null;
  const {mode, setMode, isArchive} = useMonitorMode(projectKey);
  useMonitorWindows(scene?.id ?? null, projectKey, isArchive);

  const engineActive = Boolean(scene && currentProject);
  const {status, compileErrors, runtimeErrors, sessionId, statusDetail, isStale, subscribeTasks, archive} =
    useRuntimeEngine(engineActive, mode);
  // Плеер — ровно один, здесь же: два применяли бы ленту дважды.
  const replayControls = useArchiveReplay(archive, engineActive && isArchive);

  useMonitorRevoked(status);

  // Подписка на статусы задач — пока монитор открыт. sessionId меняется при каждом переподключении
  // и смене проекта: повторная подписка безвредна, сервер просто пришлёт полный список ещё раз.
  useEffect(() => {
    if (sessionId) subscribeTasks();
  }, [sessionId, subscribeTasks]);

  const [showTasks, setShowTasks] = useState(false);

  // Вкладка «Процедуры» — ровно тот же приём, что у «Рецептов» в редакторе:
  // SceneTabs умеет вкладку-не-схему через `extraTab`, менять его не пришлось.
  const [showProcedures, setShowProcedures] = useState(false);

  // Опрос состояния процедуры, подсказка восстановления и тосты об отказах — РОВНО ЗДЕСЬ.
  // Их два потребителя (панель и HUD), и повтори каждый эти эффекты у себя, вышло бы
  // два опроса и по два тоста на событие.
  useProcedureSync();

  const isLive = !isArchive && status === "live";

  return (
    <PageFrame>
      {/* Тонкий тулбар: проект / сцена / индикатор соединения */}
      {/* В одну строку на любой ширине: второстепенные подписи ниже xl сворачиваются до иконок
          (полный текст — в подсказке), а не переносят панель на вторую строку. */}
      <PageHeader title="Монитор" className="gap-2 xl:gap-3">

        <ProjectSelect
          projects={projectList}
          value={currentProject?.id}
          onChange={(id) => setCurrentProject(projectList.find(p => p.id === id) ?? null)}
          // Помечаем только выключенные: это объясняет, почему у проекта не будет данных.
          // Пометка у рабочих была бы шумом — их большинство.
          labelOf={(p) => `${p.name}${runtimeFlags[p.id] === false ? " — не в эксплуатации" : ""}`}
        />

        <Select
          size="sm"
          className="min-w-0 max-w-56 shrink"
          value={scene?.id == null ? "" : String(scene.id)}
          disabled={!currentProject}
          onValueChange={(v) => {
            const id = Number(v);
            if (Number.isSafeInteger(id)) void loadScene(id);
          }}
          placeholder="Схема…"
          options={sceneList.map(s => ({value: String(s.id), label: s.name}))}
        />

        <div className="flex-1" />

        <SegmentedControl
          aria-label="Режим монитора"
          value={mode}
          onValueChange={m => {
            setMode(m);
            // Процедуры — живое управление, в архиве им не место.
            if (m === "archive") { setShowProcedures(false); setShowTasks(false); }
          }}
          items={[
            {value: "live", label: "Живые данные", icon: Radio, tone: "success"},
            {value: "archive", label: "Архив", icon: History, tone: "warning", disabled: !scene},
          ]}
        />

        <MonitorActions
          live={isLive && Boolean(sessionId)}
          showProcedures={showProcedures}
          onShowProcedures={() => setShowProcedures(true)}
          showTasks={showTasks}
          onToggleTasks={() => setShowTasks(v => !v)}
        />

        <MonitorStatusBadges
          hasScene={Boolean(scene)}
          isArchive={isArchive}
          status={status}
          statusDetail={statusDetail}
          isStale={isStale}
          compileErrors={compileErrors}
          runtimeErrors={runtimeErrors}
          releaseVersionNo={releaseVersionNo}
        />
      </PageHeader>

      {isArchive && scene && <ArchivePlayerBar controls={replayControls} />}

      {/* Панель быстрого доступа — тот же компонент, что и в редакторе. Вкладки ведут
          только на закреплённые схемы, поэтому список «Схема…» выше остаётся: он
          единственный способ открыть любую другую. Ни схемы, ни закреплённых — полоса
          не рисуется вовсе (SceneTabs вернёт null). */}
      <SceneTabs
        activeKey={showProcedures ? PROCEDURES_TAB.key : (scene ? `scene:${scene.id}` : "")}
        onActivate={(key) => {
          if (key === PROCEDURES_TAB.key) { setShowProcedures(true); return; }
          setShowProcedures(false);
          const id = Number(key.slice("scene:".length));
          // Без openSceneGuarded: монитор не редактирует, спрашивать про
          // несохранённые правки не о чем, палитра ему не нужна.
          if (Number.isSafeInteger(id) && id !== scene?.id) void loadScene(id);
        }}
        extraTab={isArchive ? undefined : PROCEDURES_TAB}
        contentId="monitor-canvas"
        ariaLabel="Закреплённые схемы"
        // Закрепления — общая настройка проекта, их меняет инженер в редакторе.
        editable={false}
      />

      {/* Холст: read-only, пан/зум доступны */}
      {/* `relative` — точка отсчёта для HUD процедуры: он absolute внутри этого блока.
          Не `fixed`, как у баннеров редактора: там опорой служат --ws-*-m, которых
          в мониторе нет, и пришлось бы вручную вычитать тулбар и полосу вкладок. */}
      <div id="monitor-canvas" className="relative flex-1 min-h-0 overflow-hidden bg-card">
        {showProcedures ? (
          <ProcedurePanel />
        ) : releaseError && !scene ? (
          <NoReleaseNotice message={releaseError} />
        ) : !isArchive && status === "rejected" ? (
          <RejectedNotice detail={statusDetail} />
        ) : scene ? (
          <Canvas readOnly archive={isArchive} />
        ) : (
          <EmptyState size="sm" title={currentProject ? "Выберите схему" : "Выберите проект и схему"} className="h-full justify-center" />
        )}

        {/* Над вкладкой «Процедуры» HUD не нужен — он дублировал бы её и закрывал. */}
        {!showProcedures && !isArchive && <ProcedureHud />}
        {/* «Опции» и инспектор — плавающие окна над схемой, не модалки. */}
        {!showProcedures && !isArchive && <FloatingWindowsLayer />}
        {showTasks && <AutomationTaskPanel onClose={() => setShowTasks(false)} />}
      </div>
    </PageFrame>
  );
}
