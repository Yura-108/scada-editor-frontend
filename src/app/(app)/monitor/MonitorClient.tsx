"use client";

import React, {useEffect, useRef, useState} from "react";
import {ClipboardList, Cpu, History, Radio, SearchCode} from "lucide-react";
import {openObjectInspectorModal} from "@/components/monitor/ObjectInspectorModal";
import {FloatingWindowsLayer} from "@/components/monitor/FloatingWindowsLayer";
import {closeFloatingWindows} from "@/store/useFloatingWindowsStore";
import Canvas from "@/components/editor/Canvas";
import {useEditorStore} from "@/modules/editor";
import {useRuntimeEngine, type RuntimeMode} from "@/lib/runtime/useRuntimeEngine";
import {useArchiveReplay} from "@/lib/runtime/useArchiveReplay";
import {ArchivePlayerBar} from "@/components/monitor/ArchivePlayerBar";
import {cn} from "@/shared/lib/cn";
import {ProcedurePanel} from "@/components/monitor/ProcedurePanel";
import {ProcedureHud} from "@/components/monitor/ProcedureHud";
import {AutomationTaskPanel, countTaskProblems} from "@/components/monitor/AutomationTaskPanel";
import {useAutomationTasksStore} from "@/store/useAutomationTasksStore";
import {useProcedureSync} from "@/lib/runtime/useProcedureSync";
import {useSceneCameraMemory} from "@/components/editor/canvas/hooks/useSceneCameraMemory";
import {SceneTabs} from "@/components/editor/SceneTabs";
import {toast} from "sonner";
import {useCurrentProjectGrant} from "@/lib/access/projectAccess";
import {canWriteDirectly} from "@/lib/runtime/actionAccess";
import {restoreLastProject} from "@/lib/editor/lastProject";
import {lastMonitorScene, rememberMonitorScene} from "@/lib/editor/projectMemory";
import {MonitorStatusBadges} from "@/modules/monitor";

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
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);
  const loadSceneList = useEditorStore(s => s.loadSceneList);
  const loadScene = useEditorStore(s => s.loadScene);
  const runtimeFlags = useEditorStore(s => s.projectRuntimeFlags);
  const releaseVersionNo = useEditorStore(s => s.releaseVersionNo);
  const releaseError = useEditorStore(s => s.releaseError);
  const loadProjectRuntimeFlag = useEditorStore(s => s.loadProjectRuntimeFlag);

  // Своя память вида: пан оператора не должен сбивать камеру в редакторе.
  useSceneCameraMemory("monitor");

  // Монитор не редактирует, но стор общий с редактором: страхуемся от случайных
  // записей в историю undo на время жизни страницы.
  useEffect(() => {
    // Монитор рисует prod-выпуск, не черновик редактора (контракт
    // 2026-09-29-project-release-contract.md). Первым делом, до загрузки списка схем ниже:
    // стор откладывает документ редактора и дальше читает схемы из выпуска.
    useEditorStore.getState().setSceneSource("release");
    const temporal = useEditorStore.temporal.getState();
    temporal.pause();
    useEditorStore.getState().clearSelection();
    // Уровень (activeGroupKey) общий с редактором: в монитор нужно входить с корня
    // сцены, а выходя — не оставлять редактору чужой открытый компонент.
    useEditorStore.setState({activeGroupKey: null});
    return () => {
      // Рантайм-карты чистит cleanup движка (clearRuntime).
      useEditorStore.setState({activeGroupKey: null});
      // Возврат к черновику: стор кладёт на место документ редактора как был.
      useEditorStore.getState().setSceneSource("draft");
      useEditorStore.temporal.getState().resume();
    };
  }, []);

  // Проект и схему монитор помнит: оператор возвращается к тому же экрану после перезагрузки
  // и после похода в другие разделы, а не выбирает их каждый раз заново.
  useEffect(() => {
    void loadProjectList().then(projects => { if (projects) restoreLastProject(projects); });
  }, [loadProjectList]);

  useEffect(() => {
    if (currentProject) void loadSceneList(currentProject.id);
  }, [currentProject, loadSceneList]);

  // Последняя схема — один раз на проект, когда список схем выпуска уже есть, а схема не открыта.
  // Схемы, которой нет в выпуске, не открываем: её удалили или не выпустили.
  const restoredSceneFor = useRef<number | null>(null);
  useEffect(() => {
    if (!currentProject || scene || sceneList.length === 0) return;
    if (restoredSceneFor.current === currentProject.id) return;
    restoredSceneFor.current = currentProject.id;
    const last = lastMonitorScene(currentProject.id);
    if (last != null && sceneList.some(s => s.id === last)) void loadScene(last);
  }, [currentProject, scene, sceneList, loadScene]);

  const openSceneId = scene?.id != null ? Number(scene.id) : null;
  useEffect(() => {
    if (currentProject && openSceneId != null && Number.isSafeInteger(openSceneId)) {
      rememberMonitorScene(currentProject.id, openSceneId);
    }
  }, [currentProject, openSceneId]);

  // Флаг эксплуатации приходит отдельным эндпоинтом. Без него выключенный проект в списке
  // неотличим от рабочего, и оператор узнавал бы о причине, только не дождавшись данных.
  useEffect(() => {
    for (const p of projectList) void loadProjectRuntimeFlag(p.id);
  }, [projectList, loadProjectRuntimeFlag]);

  // «Архив» — воспроизведение сцены по архиву тегов: WS не подключается, действия выключены.
  // Смена проекта возвращает в живой режим: период и курсор принадлежали прошлому.
  // Режим помнится вместе с проектом, в котором его выбрали: для другого проекта он «живой».
  const projectKey = currentProject?.id ?? null;
  const [modeChoice, setModeChoice] = useState<{mode: RuntimeMode; project: number | null}>(
    {mode: "live", project: null},
  );
  const mode: RuntimeMode = modeChoice.project === projectKey ? modeChoice.mode : "live";
  const setMode = (m: RuntimeMode) => setModeChoice({mode: m, project: projectKey});
  const isArchive = mode === "archive";

  // Плавающие окна. «Опции» принадлежат компоненту открытой схемы — на другой схеме их
  // компонента нет. Инспектор от схемы не зависит, но смена проекта, вход в архив (записи там
  // невозможны) и уход со страницы закрывают всё.
  const sceneIdForWindows = scene?.id ?? null;
  useEffect(() => { closeFloatingWindows("options"); }, [sceneIdForWindows]);
  useEffect(() => { closeFloatingWindows(); }, [projectKey, isArchive]);
  useEffect(() => () => closeFloatingWindows(), []);

  const engineActive = Boolean(scene && currentProject);
  const {status, compileErrors, runtimeErrors, sessionId, statusDetail, isStale, subscribeTasks, archive} =
    useRuntimeEngine(engineActive, mode);
  // Плеер — ровно один, здесь же: два применяли бы ленту дважды.
  const replayControls = useArchiveReplay(archive, engineActive && isArchive);

  // 4403: права отозваны (или учётка отключена). Переподключаться бессмысленно — уводим к
  // выбору проекта и перечитываем список: отозванный проект из него пропадёт.
  useEffect(() => {
    if (status !== "revoked") return;
    const name = useEditorStore.getState().currentProject?.name;
    toast.error(name ? `Доступ к проекту «${name}» отозван` : "Доступ к проекту отозван");
    setCurrentProject(null);
    void loadProjectList();
  }, [status, setCurrentProject, loadProjectList]);

  // «Опции» и инспектор пишут теги/свойства напрямую: «управление» и уровень ≥ 9.
  const directWrite = canWriteDirectly(useCurrentProjectGrant());

  // Подписка на статусы задач — пока монитор открыт. sessionId меняется при каждом переподключении
  // и смене проекта: повторная подписка безвредна, сервер просто пришлёт полный список ещё раз.
  useEffect(() => {
    if (sessionId) subscribeTasks();
  }, [sessionId, subscribeTasks]);

  const [showTasks, setShowTasks] = useState(false);
  const taskProblems = useAutomationTasksStore(s => countTaskProblems(s.byId));

  // Вкладка «Процедуры» — ровно тот же приём, что у «Рецептов» в редакторе:
  // SceneTabs умеет вкладку-не-схему через `extraTab`, менять его не пришлось.
  const [showProcedures, setShowProcedures] = useState(false);

  // Опрос состояния процедуры, подсказка восстановления и тосты об отказах — РОВНО ЗДЕСЬ.
  // Их два потребителя (панель и HUD), и повтори каждый эти эффекты у себя, вышло бы
  // два опроса и по два тоста на событие.
  useProcedureSync();

  const isLive = !isArchive && status === "live";

  const selectClasses = cn(
    "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg",
    "px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
  );

  return (
    <div className="fixed inset-0 top-(--app-header-h) overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 flex flex-col">
      {/* Тонкий тулбар: проект / сцена / индикатор соединения */}
      {/* В одну строку на любой ширине: второстепенные подписи ниже xl сворачиваются до иконок
          (полный текст — в подсказке), а не переносят панель на вторую строку. */}
      <div className="h-12 shrink-0 flex items-center gap-2 xl:gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md whitespace-nowrap overflow-x-auto">
        <span className="hidden xl:inline text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Монитор
        </span>

        <select
          className={cn(selectClasses, "min-w-0 max-w-48 shrink")}
          value={currentProject?.id ?? ""}
          onChange={(e) => {
            const project = projectList.find(p => p.id === Number(e.target.value)) ?? null;
            setCurrentProject(project);
          }}
        >
          <option value="" disabled>Проект…</option>
          {/* Помечаем только выключенные: это объясняет, почему у проекта не будет данных.
              Пометка у рабочих была бы шумом — их большинство. */}
          {projectList.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{runtimeFlags[p.id] === false ? " — не в эксплуатации" : ""}
            </option>
          ))}
        </select>

        <select
          className={cn(selectClasses, "min-w-0 max-w-56 shrink")}
          value={scene?.id ?? ""}
          disabled={!currentProject}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (Number.isSafeInteger(id)) void loadScene(id);
          }}
        >
          <option value="" disabled>Схема…</option>
          {sceneList.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="flex-1" />

        <div className="flex shrink-0 rounded-full border border-neutral-200 dark:border-neutral-700 p-0.5 text-xs font-medium">
          {([["live", "Живые данные"], ["archive", "Архив"]] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              disabled={m === "archive" && !scene}
              onClick={() => {
                setMode(m);
                // Процедуры — живое управление, в архиве им не место.
                if (m === "archive") { setShowProcedures(false); setShowTasks(false); }
              }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-colors disabled:opacity-40",
                mode === m
                  ? (m === "archive"
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
              )}
            >
              {m === "archive" ? <History size={12} /> : <Radio size={12} />}
              {label}
            </button>
          ))}
        </div>

        {isLive && sessionId && !showProcedures && (
          <button
            onClick={() => setShowProcedures(true)}
            title="Процедуры"
            className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-colors"
          >
            <ClipboardList size={14} />
            <span className="hidden xl:inline">Процедуры</span>
          </button>
        )}

        {/* Инспектор объектов: любой объект выпуска со всех схем, все его свойства с правкой.
            Только при живой сессии — в архиве записи невозможны, а значения из прошлого. */}
        {isLive && sessionId && directWrite && (
          <button
            onClick={() => openObjectInspectorModal()}
            className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-colors"
            title="Инспектор объектов: свойства любого объекта проекта"
          >
            <SearchCode size={14} />
            <span className="hidden xl:inline">Инспектор</span>
          </button>
        )}

        {isLive && sessionId && (
          <button
            onClick={() => setShowTasks(v => !v)}
            aria-pressed={showTasks}
            className={cn(
              "flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
              taskProblems > 0
                ? "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25"
                : "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25",
            )}
            title={taskProblems > 0 ? `Задач с проблемами: ${taskProblems}` : "Фоновые задачи проекта"}
          >
            <Cpu size={14} />
            <span className="hidden xl:inline">Задачи</span>
            {taskProblems > 0 && <span><span className="hidden xl:inline">: </span>{taskProblems}</span>}
          </button>
        )}

        <MonitorStatusBadges
          status={status}
          hasScene={Boolean(scene)}
          statusDetail={statusDetail}
          isArchive={isArchive}
          isStale={isStale}
          compileErrors={compileErrors}
          runtimeErrors={runtimeErrors}
          releaseVersionNo={releaseVersionNo}
        />
      </div>

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
      <div id="monitor-canvas" className="relative flex-1 min-h-0 overflow-hidden bg-white dark:bg-neutral-900">
        {showProcedures ? (
          <ProcedurePanel />
        ) : releaseError && !scene ? (
          /* Выпуск не отдаётся (проект не в эксплуатации): схем нет вовсе, и пустой холст
             выглядел бы поломкой. */
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <div className="font-medium">Нет выпуска для показа</div>
              <p>{releaseError}</p>
              <p className="text-xs opacity-80">
                Монитор показывает prod-выпуск проекта, а его исполняет только проект в
                эксплуатации. Ввести проект и выбрать выпуск можно в редакторе.
              </p>
            </div>
          </div>
        ) : !isArchive && status === "rejected" ? (
          /* Состояние «проект выключен» должно быть видимым, а не выглядеть поломкой:
             текст причины приходит с бэкенда и называет её прямо. */
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md space-y-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <div className="font-medium">Монитор не подключён</div>
              <p>{statusDetail || "Рантайм отклонил подключение."}</p>
              <p className="text-xs opacity-80">
                Проект исполняется, только когда он введён в эксплуатацию — включить его можно
                в списке проектов, после этого выберите схему заново. Если причина в правах
                доступа, их выдаёт администратор.
              </p>
            </div>
          </div>
        ) : scene ? (
          <Canvas readOnly archive={isArchive} />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 text-sm">
            Выберите проект и сцену для мониторинга
          </div>
        )}

        {/* Над вкладкой «Процедуры» HUD не нужен — он дублировал бы её и закрывал. */}
        {!showProcedures && !isArchive && <ProcedureHud />}
        {/* «Опции» и инспектор — плавающие окна над схемой, не модалки. */}
        {!showProcedures && !isArchive && <FloatingWindowsLayer />}
        {showTasks && <AutomationTaskPanel onClose={() => setShowTasks(false)} />}
      </div>
    </div>
  );
}
