"use client";

import React, {useCallback, useEffect, useRef, useState} from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, CircleStop, GripVertical, Pause, Play, TimerReset,
} from "lucide-react";
import {cn} from "@/lib/utils";
import {useRecipeStore} from "@/store/useRecipeStore";
import {useProcedureStore} from "@/store/useProcedureStore";
import {useProcedureControls} from "@/lib/runtime/useProcedureControls";
import {CLOCK_TICK_MS, formatElapsed} from "@/lib/runtime/procedureFormat";
import {
  clampHudPosition, DEFAULT_HUD_PREFS, isRightAligned, readHudPrefs, writeHudPrefs,
  type HudPrefs,
} from "@/lib/editor/procedureHudPrefs";

/**
 * Ведение процедуры ПОВЕРХ мнемосхемы.
 *
 * Раньше состояние и кнопки жили только во вкладке «Процедуры», а она подменяет собой холст:
 * чтобы подтвердить шаг, оператор уходил со схемы и переставал видеть процесс, которым
 * управляет. HUD снимает этот выбор — вести и наблюдать можно одновременно.
 *
 * Своего поведения у него нет: действия берутся из `useProcedureControls`, состояние — из
 * `useProcedureStore`, а опрос и уведомления живут в `useProcedureSync`, смонтированном
 * один раз в `MonitorClient`.
 */

/** Отступ от краёв области схемы. */
const MARGIN = 8;

/** Запись настройки с задержкой — как у остальных localStorage-помощников проекта. */
const SAVE_DELAY_MS = 300;

export function ProcedureHud() {
  const {recipes, loaded, loadRecipes} = useRecipeStore();
  const {recipeId, status, stepStartedAt, resumeHint, watch} = useProcedureStore();
  const {busy, start, confirm, jump, abort} = useProcedureControls();

  const hudRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<HudPrefs>(DEFAULT_HUD_PREFS);
  const [hydrated, setHydrated] = useState(false);
  /**
   * Секундомер шага. Держим готовое число, а не считаем `Date.now()` в теле рендера:
   * рендер обязан быть чистым (`react-hooks/purity`), а тик и так нужен для перерисовки.
   */
  const [elapsed, setElapsed] = useState(0);

  const recipe = recipes.find(r => r.id === recipeId) ?? null;
  const steps = recipe?.steps ?? [];

  useEffect(() => {
    if (!loaded) void loadRecipes();
  }, [loaded, loadRecipes]);

  useEffect(() => {
    const tick = () => setElapsed(stepStartedAt != null ? Date.now() - stepStartedAt : 0);
    tick();
    const id = setInterval(tick, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [stepStartedAt]);

  /**
   * Настройку читаем ПОСЛЕ монтирования, а не в инициализаторе `useState`: на сервере
   * localStorage нет, и разметка разошлась бы с клиентской (то же правило в WorkSpace
   * и useSceneCameraMemory).
   */
  useEffect(() => {
    const saved = readHudPrefs();
    const node = hudRef.current;
    const area = node?.parentElement;

    if (node && area) {
      const box = node.getBoundingClientRect();
      const size = {width: box.width, height: box.height};
      const bounds = {width: area.clientWidth, height: area.clientHeight};
      // `x < 0` — «прижать к правому краю»: ширину узнаём только сейчас.
      const x = isRightAligned(saved.x) ? bounds.width - size.width - MARGIN : saved.x;
      setPrefs({...saved, ...clampHudPosition(x, saved.y, size, bounds, MARGIN)});
    } else {
      setPrefs(saved);
    }
    setHydrated(true);
  }, []);

  // Сохранение с задержкой: перетаскивание иначе писало бы в localStorage на каждый кадр.
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => writeHudPrefs(prefs), SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [prefs, hydrated]);

  /**
   * Перетаскивание за шапку.
   *
   * Во время жеста двигаем узел напрямую через `style`, а в состояние React пишем только
   * на `pointerup` — тот же приём, что у ручек панелей в `WorkSpace`: иначе выходят сотни
   * перерисовок за одно перетаскивание.
   */
  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const node = hudRef.current;
    const area = node?.parentElement;
    if (!node || !area || e.button !== 0) return;

    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const box = node.getBoundingClientRect();
    const areaBox = area.getBoundingClientRect();
    const grabX = e.clientX - box.left;
    const grabY = e.clientY - box.top;
    const size = {width: box.width, height: box.height};
    const bounds = {width: area.clientWidth, height: area.clientHeight};

    let next = {x: box.left - areaBox.left, y: box.top - areaBox.top};

    const onMove = (ev: PointerEvent) => {
      next = clampHudPosition(
        ev.clientX - areaBox.left - grabX,
        ev.clientY - areaBox.top - grabY,
        size, bounds, MARGIN,
      );
      node.style.left = `${next.x}px`;
      node.style.top = `${next.y}px`;
    };

    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setPrefs(prev => ({...prev, ...next}));
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, []);

  const isRunning = Boolean(status && !status.completed);

  const dotClass = !status ? "bg-neutral-400"
    : status.completed ? "bg-emerald-500"
    : status.stalled ? "bg-amber-500"
    : "bg-blue-500 animate-pulse";

  const iconButton = cn(
    "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
    "disabled:opacity-40 disabled:cursor-not-allowed",
  );

  return (
    <div
      ref={hudRef}
      role="region"
      aria-label="Управление процедурой"
      className={cn(
        "absolute z-toolbar w-max min-w-[min(720px,calc(100%-1rem))] max-w-[min(980px,calc(100%-1rem))]",
        "rounded-xl border border-neutral-200 dark:border-neutral-800",
        "bg-white/95 dark:bg-neutral-900/95 shadow-2xl backdrop-blur-xl",
        // До чтения настройки не показываем: иначе окно прыгнуло бы из угла в угол.
        hydrated ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={{left: prefs.x, top: prefs.y}}
    >
      {/* ─── Свёрнутая полоска: в ней уже есть всё для ведения процесса ─── */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div
          onPointerDown={handleDragStart}
          className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 touch-none"
          title="Перетащить"
        >
          <GripVertical size={16} />
        </div>

        {/* Переключать рецепт можно и на ходу: процедура на бэкенде живёт под ключом
            (сессия, рецепт), и смена выбора меняет лишь то, за чем мы наблюдаем —
            запущенная продолжает идти, а по возвращении её состояние вернёт GET /status. */}
        <select
          className={cn(
            "w-56 shrink-0 rounded-md border border-neutral-300 dark:border-neutral-700",
            "bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
          )}
          value={recipeId ?? ""}
          onChange={(e) => watch(e.target.value || null)}
        >
          <option value="" disabled>Процедура…</option>
          {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />

        <span className="min-w-0 flex-1 truncate text-xs text-neutral-700 dark:text-neutral-300">
          {!recipeId ? "процедура не выбрана"
            : !status ? "не запущена"
            : status.completed ? "завершена"
            : `Шаг ${status.stepIndex + 1}/${steps.length || "?"}`
              + `${status.stepName ? ` · ${status.stepName}` : ""} · ${formatElapsed(elapsed)}`}
        </span>

        {status?.stalled && (
          <span className="shrink-0 text-amber-600 dark:text-amber-400" title="Шаг долго не завершается">
            <AlertTriangle size={14} />
          </span>
        )}

        {recipeId && !isRunning && (
          <button
            className={cn(iconButton, "gap-1 px-2 bg-blue-600 text-white hover:bg-blue-500")}
            disabled={busy}
            onClick={() => start(recipeId)}
            title="Запустить процедуру"
          >
            <Play size={13} />
            <span className="text-xs font-medium">Запустить</span>
          </button>
        )}

        {recipeId && isRunning && (
          <>
            <button
              className={cn(iconButton, "gap-1 px-2 bg-blue-600 text-white hover:bg-blue-500")}
              disabled={busy}
              onClick={() => confirm(recipeId)}
              title="Подтвердить текущий шаг"
            >
              <Check size={13} />
              <span className="text-xs font-medium">Подтвердить</span>
            </button>
            {/* Паузы на бэкенде НЕТ: у процедуры шесть ручек (start/status/confirm/jump/
                abort/resume-guess), и слова `pause` в рантайме не существует. Кнопка стоит
                неактивной намеренно — «пауза», нарисованная на клиенте, была бы обманом:
                процедура продолжала бы идти и писать теги в ПЛК, пока оператор считает её
                остановленной. Включается одной строкой, как появится ручка. */}
            <button
              className={cn(iconButton, "gap-1 px-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-500")}
              disabled
              title="Пауза пока недоступна: на бэкенде нет ручки POST /api/runtime/recipes/{id}/pause"
            >
              <Pause size={13} />
              <span className="text-xs font-medium">Пауза</span>
            </button>
            <button
              className={cn(iconButton, "bg-red-600 text-white hover:bg-red-500")}
              disabled={busy}
              onClick={() => abort(recipeId)}
              title="Прервать процедуру"
            >
              <CircleStop size={14} />
            </button>
          </>
        )}

        <button
          className={cn(iconButton, "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800")}
          onClick={() => setPrefs(prev => ({...prev, collapsed: !prev.collapsed}))}
          title={prefs.collapsed ? "Показать шаги" : "Свернуть"}
        >
          {prefs.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* ─── Развёрнутая часть: шаги, подсказка восстановления ─── */}
      {!prefs.collapsed && recipeId && (
        <div className="max-h-72 overflow-y-auto custom-scrollbar border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 space-y-2">
          {resumeHint !== null && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium">
                <TimerReset size={13} />
                Процедура не найдена в памяти рантайма
              </div>
              <p>
                Похоже, она остановилась на шаге <b>{resumeHint + 1}</b>
                {steps[resumeHint]?.name ? ` — «${steps[resumeHint].name}»` : ""}. Подсказка может
                ошибаться на шагах с условием по времени или подтверждению.
              </p>
              <button
                className="rounded-md bg-blue-600 px-2 py-1 font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                disabled={busy}
                onClick={() => jump(recipeId, resumeHint)}
              >
                Продолжить с шага {resumeHint + 1}
              </button>
            </div>
          )}

          {steps.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">У процедуры нет шагов.</p>
          ) : (
            <ul className="space-y-0.5">
              {steps.map((step, index) => {
                const current = !status?.completed && status?.stepIndex === index;
                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                      current ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "text-neutral-600 dark:text-neutral-400",
                    )}
                  >
                    <span className="w-5 shrink-0 tabular-nums text-neutral-400">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {step.name || <span className="italic text-neutral-400">без названия</span>}
                    </span>
                    <button
                      className="shrink-0 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                      disabled={busy}
                      onClick={() => jump(recipeId, index)}
                    >
                      перейти
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
