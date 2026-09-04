"use client";

import React, {useEffect, useMemo} from "react";
import {AlertTriangle, ClipboardList, Clock, Pin, PinOff, Radio} from "lucide-react";
import Canvas from "@/components/editor/Canvas";
import {useEditorStore} from "@/store/useEditorStore";
import {usePinnedScenesStore} from "@/store/usePinnedScenesStore";
import {useRuntimeEngine} from "@/lib/runtime/useRuntimeEngine";
import type {RuntimeStatus} from "@/lib/runtime/runtimeConnection";
import {cn} from "@/lib/utils";
import openApplyRecipeModal from "@/components/monitor/ApplyRecipeModal";
import {useSceneCameraMemory} from "@/components/editor/canvas/hooks/useSceneCameraMemory";
import {SceneTabs} from "@/components/editor/SceneTabs";

const STATUS_VIEW: Record<RuntimeStatus, {label: string; className: string}> = {
  connecting: {label: "Подключение…", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  live: {label: "Живые данные", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"},
  reconnecting: {label: "Переподключение…", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  closed: {label: "Нет соединения", className: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400"},
  // Окончательный отказ (код закрытия 1003) — реконнект не запускается, обновление
  // страницы/повторный выбор сцены нужны, чтобы попробовать снова.
  rejected: {label: "Соединение отклонено", className: "bg-red-500/15 text-red-600 dark:text-red-400"},
};

/**
 * Скрепка «закрепить текущую схему» — вход в ту же настройку, что и в модалке выбора
 * схемы редактора (см. OpenChooseSceneModal), поэтому подписи и вид те же.
 *
 * Отдельным компонентом ради его собственной подписки на `pins`: держи её в
 * `MonitorClient`, и каждое закрепление перерисовывало бы весь монитор вместе с холстом.
 */
function ScenePinButton({scene}: {scene: {id: number; name: string} | null}) {
  const pins = usePinnedScenesStore(s => s.pins);
  const togglePin = usePinnedScenesStore(s => s.togglePin);

  const isPinned = !!scene && pins.some(p => p.id === scene.id);
  const label = isPinned ? "Открепить схему" : "Закрепить схему";

  return (
    <button
      type="button"
      disabled={!scene}
      aria-pressed={isPinned}
      // `togglePin` сам откажет без проекта и сам скажет про предел закреплённых.
      onClick={() => scene && togglePin({id: scene.id, name: scene.name})}
      title={scene ? `${label} «${scene.name}»` : "Сначала откройте схему"}
      aria-label={scene ? `${label} «${scene.name}»` : label}
      className={cn(
        "shrink-0 rounded-lg p-1.5 transition-colors",
        !scene && "text-neutral-300 dark:text-neutral-700 cursor-not-allowed",
        scene && isPinned && "text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40",
        scene && !isPinned && "text-neutral-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40",
      )}
    >
      {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
    </button>
  );
}

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

  // Своя память вида: пан оператора не должен сбивать камеру в редакторе.
  useSceneCameraMemory("monitor");

  // Монитор не редактирует, но стор общий с редактором: страхуемся от случайных
  // записей в историю undo на время жизни страницы.
  useEffect(() => {
    const temporal = useEditorStore.temporal.getState();
    temporal.pause();
    useEditorStore.getState().clearSelection();
    return () => {
      // Рантайм-карты чистит cleanup движка (clearRuntime).
      useEditorStore.temporal.getState().resume();
    };
  }, []);

  useEffect(() => {
    void loadProjectList();
  }, [loadProjectList]);

  useEffect(() => {
    if (currentProject) void loadSceneList(currentProject.id);
  }, [currentProject, loadSceneList]);

  const {status, compileErrors, runtimeErrors, sessionId, rejectionReason, isStale} = useRuntimeEngine(Boolean(scene && currentProject));

  const problemCount = useMemo(
    () => compileErrors.size + runtimeErrors.size,
    [compileErrors, runtimeErrors],
  );

  const statusView = STATUS_VIEW[scene ? status : "closed"];

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
          {projectList.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
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

        <ScenePinButton scene={scene ? {id: scene.id, name: scene.name} : null} />

        <div className="flex-1" />

        {status === "live" && sessionId && (
          <button
            onClick={() => openApplyRecipeModal({sessionId})}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-colors"
          >
            <ClipboardList size={14} />
            Применить рецепт
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

        {isStale && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400"
            title="Соединение живое, но новых значений давно не приходило — данные на экране могут быть устаревшими"
          >
            <Clock size={14} />
            Данные могут устареть
          </span>
        )}

        <span
          className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", statusView.className)}
          title={status === "rejected" && rejectionReason ? rejectionReason : undefined}
        >
          <Radio size={14} />
          {statusView.label}
        </span>
      </div>

      {/* Панель быстрого доступа — тот же компонент, что и в редакторе. Вкладки ведут
          только на закреплённые схемы, поэтому список «Схема…» выше остаётся: он
          единственный способ открыть любую другую. Ни схемы, ни закреплённых — полоса
          не рисуется вовсе (SceneTabs вернёт null). */}
      <SceneTabs
        activeKey={scene ? `scene:${scene.id}` : ""}
        onActivate={(key) => {
          const id = Number(key.slice("scene:".length));
          // Без openSceneGuarded: монитор не редактирует, спрашивать про
          // несохранённые правки не о чем, палитра ему не нужна.
          if (Number.isSafeInteger(id) && id !== scene?.id) void loadScene(id);
        }}
        contentId="monitor-canvas"
        ariaLabel="Закреплённые схемы"
      />

      {/* Холст: read-only, пан/зум доступны */}
      <div id="monitor-canvas" className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-neutral-900">
        {scene ? (
          <Canvas readOnly />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 text-sm">
            Выберите проект и сцену для мониторинга
          </div>
        )}
      </div>
    </div>
  );
}
