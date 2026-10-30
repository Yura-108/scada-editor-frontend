"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import {AlertTriangle, CircleAlert, ClipboardList, Clock, Cpu, History, Package, Radio, SearchCode} from "lucide-react";
import {
  ArchivePlayerBar, AutomationTaskPanel, closeFloatingWindows, countTaskProblems, FloatingWindowsLayer,
  openObjectInspectorModal, ProcedureHud, ProcedurePanel, registerMonitorDialogs, useArchiveReplay,
  useAutomationTasksStore, useProcedureSync, useRuntimeEngine, type RuntimeMode,
} from "@/modules/monitor";
import {Canvas, useEditorStore, useSceneCameraMemory, SceneTabs, restoreLastProject} from "@/modules/editor";
import type {RuntimeStatus} from "@/modules/monitor";
import {toast} from "sonner";
import {useCurrentProjectGrant, canWriteDirectly} from "@/core/access";
import {lastMonitorScene, rememberMonitorScene} from "@/core/project";
import {ProjectSelect} from "@/core/project";
import {Select} from "@/shared/ui/field/Select";
import {PageFrame} from "@/shared/ui/page/PageFrame";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {Badge} from "@/shared/ui/Badge";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {EmptyState} from "@/shared/ui/EmptyState";
import {SegmentedControl} from "@/shared/ui/SegmentedControl";
import type {Tone} from "@/shared/ui/tone";

// Окна монитора для меню элемента на холсте.
registerMonitorDialogs();

/** Вкладка выполнения процедур. Не схема — у неё нет `sceneId`, как у «Рецептов» в редакторе. */
const PROCEDURES_TAB = {key: "procedures", label: "Процедуры"} as const;

const STATUS_VIEW: Record<RuntimeStatus, {label: string; tone: Tone}> = {
  connecting: {label: "Подключение…", tone: "warning"},
  live: {label: "Живые данные", tone: "success"},
  reconnecting: {label: "Переподключение…", tone: "warning"},
  closed: {label: "Нет соединения", tone: "neutral"},
  // Окончательный отказ: код закрытия 1003 либо 409 на создание сессии (проект не введён
  // в эксплуатацию). Реконнект не запускается — причина показывается оператору прямо на
  // холсте, иначе выключенный проект выглядел бы неисправностью экрана.
  rejected: {label: "Соединение отклонено", tone: "destructive"},
  // Код закрытия 4403: права в проекте отозваны. Монитор сам уходит к выбору проекта.
  revoked: {label: "Доступ отозван", tone: "destructive"},
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

  const problemCount = useMemo(
    () => compileErrors.size + runtimeErrors.size,
    [compileErrors, runtimeErrors],
  );

  const statusView = STATUS_VIEW[scene ? status : "closed"];
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

        {isLive && sessionId && !showProcedures && (
          <Button size="sm" onClick={() => setShowProcedures(true)} title="Процедуры">
            <ClipboardList size={14} />
            <span className="hidden xl:inline">Процедуры</span>
          </Button>
        )}

        {/* Инспектор объектов: любой объект выпуска со всех схем, все его свойства с правкой.
            Только при живой сессии — в архиве записи невозможны, а значения из прошлого. */}
        {isLive && sessionId && directWrite && (
          <Button size="sm" onClick={() => openObjectInspectorModal()} title="Инспектор объектов: свойства любого объекта проекта">
            <SearchCode size={14} />
            <span className="hidden xl:inline">Инспектор</span>
          </Button>
        )}

        {isLive && sessionId && (
          <Button
            size="sm"
            onClick={() => setShowTasks(v => !v)}
            aria-pressed={showTasks}
            className="aria-pressed:bg-accent"
            title={taskProblems > 0 ? `Задач с проблемами: ${taskProblems}` : "Фоновые задачи проекта"}
          >
            <Cpu size={14} />
            <span className="hidden xl:inline">Задачи</span>
            {taskProblems > 0 && <Badge tone="destructive">{taskProblems}</Badge>}
          </Button>
        )}

        {problemCount > 0 && (
          <Badge
            tone="destructive"
            icon={<AlertTriangle size={12} />}
            title={[`Проблемы с привязками: ${problemCount}`,
              ...[...compileErrors.values()].map(e => `Компиляция: ${e}`),
              ...[...runtimeErrors.values()].map(e => `Исполнение: ${e}`),
            ].join("\n")}
          >
            <span className="hidden xl:inline">Проблемы с привязками: </span>{problemCount}
          </Badge>
        )}

        {!isArchive && isStale && (
          <Badge
            tone="warning"
            icon={<Clock size={12} />}
            title="Соединение живое, но новых значений давно не приходило — данные на экране могут быть устаревшими"
          >
            <span className="hidden xl:inline">Данные могут устареть</span>
          </Badge>
        )}

        {releaseVersionNo != null && (
          <Badge
            icon={<Package size={12} />}
            title={`Выпуск №${releaseVersionNo}. Монитор показывает prod-выпуск проекта. Правки редактора появятся здесь после нового выпуска.`}
          >
            <span className="hidden xl:inline">Выпуск </span>№{releaseVersionNo}
          </Badge>
        )}

        {!isArchive && (
          <Badge tone={statusView.tone} icon={<Radio size={12} />} title={statusDetail || statusView.label}>
            <span className="hidden xl:inline">{statusView.label}</span>
          </Badge>
        )}

        {/* Причина паузы рядом со статусом: «Переподключение…» без неё выглядит сбоем сети,
            хотя чинить надо остановленный экземпляр runtime, а не связь у оператора. */}
        {!isArchive && status === "reconnecting" && statusDetail && (
          <span
            className="max-w-xs truncate text-xs text-warning"
            title={statusDetail}
          >
            {statusDetail}
          </span>
        )}
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
          /* Выпуск не отдаётся (проект не в эксплуатации): схем нет вовсе, и пустой холст
             выглядел бы поломкой. */
          <div className="h-full flex items-center justify-center p-6">
            <Banner tone="warning" icon={Package} title="Нет выпуска для показа" className="max-w-md">
              <p>{releaseError}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Монитор показывает prod-выпуск проекта, а его исполняет только проект в
                эксплуатации. Ввести проект и выбрать выпуск можно в редакторе.
              </p>
            </Banner>
          </div>
        ) : !isArchive && status === "rejected" ? (
          /* Состояние «проект выключен» должно быть видимым, а не выглядеть поломкой:
             текст причины приходит с бэкенда и называет её прямо. */
          <div className="h-full flex items-center justify-center p-6">
            <Banner tone="destructive" icon={CircleAlert} title="Монитор не подключён" className="max-w-md">
              <p>{statusDetail || "Рантайм отклонил подключение."}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Проект исполняется, только когда он введён в эксплуатацию — включить его можно
                в списке проектов, после этого выберите схему заново. Если причина в правах
                доступа, их выдаёт администратор.
              </p>
            </Banner>
          </div>
        ) : scene ? (
          <Canvas readOnly archive={isArchive} />
        ) : (
          <EmptyState size="sm" title="Выберите проект и сцену для мониторинга" className="h-full justify-center" />
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
