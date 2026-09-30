"use client";

import React, {useEffect, useMemo, useState} from "react";
import {AlertTriangle, ClipboardList, Clock, Cpu, History, Package, Radio} from "lucide-react";
import Canvas from "@/components/editor/Canvas";
import {useEditorStore} from "@/store/useEditorStore";
import {useRuntimeEngine, type RuntimeMode} from "@/lib/runtime/useRuntimeEngine";
import {useArchiveReplay} from "@/lib/runtime/useArchiveReplay";
import {ArchivePlayerBar} from "@/components/monitor/ArchivePlayerBar";
import type {RuntimeStatus} from "@/lib/runtime/runtimeConnection";
import {cn} from "@/lib/utils";
import {ProcedurePanel} from "@/components/monitor/ProcedurePanel";
import {ProcedureHud} from "@/components/monitor/ProcedureHud";
import {AutomationTaskPanel, countTaskProblems} from "@/components/monitor/AutomationTaskPanel";
import {useAutomationTasksStore} from "@/store/useAutomationTasksStore";
import {useProcedureSync} from "@/lib/runtime/useProcedureSync";
import {useSceneCameraMemory} from "@/components/editor/canvas/hooks/useSceneCameraMemory";
import {SceneTabs} from "@/components/editor/SceneTabs";

/** Вкладка выполнения процедур. Не схема — у неё нет `sceneId`, как у «Рецептов» в редакторе. */
const PROCEDURES_TAB = {key: "procedures", label: "Процедуры"} as const;

const STATUS_VIEW: Record<RuntimeStatus, {label: string; className: string}> = {
  connecting: {label: "Подключение…", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  live: {label: "Живые данные", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"},
  reconnecting: {label: "Переподключение…", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  closed: {label: "Нет соединения", className: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400"},
  // Окончательный отказ: код закрытия 1003 либо 409 на создание сессии (проект не введён
  // в эксплуатацию). Реконнект не запускается — причина показывается оператору прямо на
  // холсте, иначе выключенный проект выглядел бы неисправностью экрана.
  rejected: {label: "Соединение отклонено", className: "bg-red-500/15 text-red-600 dark:text-red-400"},
};

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

  useEffect(() => {
    void loadProjectList();
  }, [loadProjectList]);

  useEffect(() => {
    if (currentProject) void loadSceneList(currentProject.id);
  }, [currentProject, loadSceneList]);

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

  const engineActive = Boolean(scene && currentProject);
  const {status, compileErrors, runtimeErrors, sessionId, statusDetail, isStale, subscribeTasks, archive} =
    useRuntimeEngine(engineActive, mode);
  // Плеер — ровно один, здесь же: два применяли бы ленту дважды.
  const replayControls = useArchiveReplay(archive, engineActive && isArchive);

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

  const problemCount = useMemo(
    () => compileErrors.size + runtimeErrors.size,
    [compileErrors, runtimeErrors],
  );

  const statusView = STATUS_VIEW[scene ? status : "closed"];
  const isLive = !isArchive && status === "live";

  const selectClasses = cn(
    "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg",
    "px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
  );

  return (
    <div className="fixed inset-0 top-(--app-header-h) overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 flex flex-col">
      {/* Тонкий тулбар: проект / сцена / индикатор соединения */}
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md">
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Монитор
        </span>

        <select
          className={selectClasses}
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
          className={selectClasses}
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

        <div className="flex rounded-full border border-neutral-200 dark:border-neutral-700 p-0.5 text-xs font-medium">
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-colors"
          >
            <ClipboardList size={14} />
            Процедуры
          </button>
        )}

        {isLive && sessionId && (
          <button
            onClick={() => setShowTasks(v => !v)}
            aria-pressed={showTasks}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
              taskProblems > 0
                ? "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25"
                : "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25",
            )}
            title={taskProblems > 0 ? `Задач с проблемами: ${taskProblems}` : "Фоновые задачи проекта"}
          >
            <Cpu size={14} />
            Задачи{taskProblems > 0 ? `: ${taskProblems}` : ""}
          </button>
        )}

        {problemCount > 0 && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-600 dark:text-red-400"
            title={[
              ...[...compileErrors.values()].map(e => `Компиляция: ${e}`),
              ...[...runtimeErrors.values()].map(e => `Исполнение: ${e}`),
            ].join("\n")}
          >
            <AlertTriangle size={14} />
            Проблемы с привязками: {problemCount}
          </span>
        )}

        {!isArchive && isStale && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400"
            title="Соединение живое, но новых значений давно не приходило — данные на экране могут быть устаревшими"
          >
            <Clock size={14} />
            Данные могут устареть
          </span>
        )}

        {releaseVersionNo != null && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-500/10 text-neutral-600 dark:text-neutral-300"
            title="Монитор показывает prod-выпуск проекта. Правки редактора появятся здесь после нового выпуска."
          >
            <Package size={14} />
            Выпуск №{releaseVersionNo}
          </span>
        )}

        {!isArchive && (
          <span
            className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", statusView.className)}
            title={statusDetail || undefined}
          >
            <Radio size={14} />
            {statusView.label}
          </span>
        )}

        {/* Причина паузы рядом со статусом: «Переподключение…» без неё выглядит сбоем сети,
            хотя чинить надо остановленный экземпляр runtime, а не связь у оператора. */}
        {!isArchive && status === "reconnecting" && statusDetail && (
          <span
            className="max-w-xs truncate text-xs text-amber-600 dark:text-amber-400"
            title={statusDetail}
          >
            {statusDetail}
          </span>
        )}
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
                Проект исполняется, только когда он введён в эксплуатацию. Включить его можно
                в списке проектов; после этого выберите схему заново.
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
        {showTasks && <AutomationTaskPanel onClose={() => setShowTasks(false)} />}
      </div>
    </div>
  );
}
