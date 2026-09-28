"use client";

import React, {useEffect, useState} from "react";
import {Info, Loader2, Pause, Play} from "lucide-react";
import {REPLAY_SPEEDS, useArchiveReplayStore} from "@/store/useArchiveReplayStore";
import type {ArchiveReplayControls} from "@/lib/runtime/useArchiveReplay";
import {ARCHIVE_DEPTH_MS} from "@/lib/runtime/archive";

/** `datetime-local` работает в местном времени без пояса. */
const toLocalInput = (ts: number) =>
  new Date(ts - new Date(ts).getTimezoneOffset() * 60_000).toISOString().slice(0, 19);

const fromLocalInput = (v: string) => new Date(v).getTime();

const formatCursor = (ts: number) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU")}`;
};

const inputClass =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs";

/**
 * Панель плеера режима «Архив»: период, пуск/пауза, скорость, ползунок времени.
 * Состояние — useArchiveReplayStore, команды — из useArchiveReplay (смонтирован в MonitorClient).
 */
export function ArchivePlayerBar({controls}: {controls: ArchiveReplayControls}) {
  const {from, to, cursor, playing, speed, loading, buffering, ended, error} = useArchiveReplayStore();

  // Черновик периода: применяется кнопкой, иначе каждый символ даты перезапрашивал бы ленту.
  const [draftFrom, setDraftFrom] = useState(() => toLocalInput(from));
  const [draftTo, setDraftTo] = useState(() => toLocalInput(to));
  useEffect(() => { setDraftFrom(toLocalInput(from)); }, [from]);
  useEffect(() => { setDraftTo(toLocalInput(to)); }, [to]);

  // Ползунок: пока тянут — показываем черновик, перематываем на отпускании (иначе запрос
  // на каждый пиксель).
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? cursor;
  const commitScrub = () => {
    if (scrub !== null) controls.seek(scrub);
    setScrub(null);
  };

  // Нижняя граница — подсказка полю даты; точный зажим всё равно делает setPeriod.
  const [openedAt] = useState(() => Date.now());
  const oldest = toLocalInput(openedAt - ARCHIVE_DEPTH_MS);
  const periodDirty = draftFrom !== toLocalInput(from) || draftTo !== toLocalInput(to);

  return (
    <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-2 border-b border-amber-500/30 bg-amber-500/5 text-xs text-neutral-700 dark:text-neutral-300">
      <label className="flex items-center gap-1.5">
        с
        <input type="datetime-local" step={1} className={inputClass} value={draftFrom} min={oldest}
          onChange={e => setDraftFrom(e.target.value)} />
      </label>
      <label className="flex items-center gap-1.5">
        по
        <input type="datetime-local" step={1} className={inputClass} value={draftTo} min={oldest}
          onChange={e => setDraftTo(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={!periodDirty}
        onClick={() => controls.setPeriod(fromLocalInput(draftFrom), fromLocalInput(draftTo))}
        className="rounded-md px-2 py-1 font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
      >
        Показать период
      </button>

      <div className="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />

      <button
        type="button"
        onClick={playing ? controls.pause : controls.play}
        disabled={loading && !playing}
        title={playing ? "Пауза" : ended ? "Сначала" : "Воспроизвести"}
        className="rounded-full p-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>

      <select
        aria-label="Скорость"
        className={inputClass}
        value={speed}
        onChange={e => controls.setSpeed(Number(e.target.value))}
      >
        {REPLAY_SPEEDS.map(s => <option key={s} value={s}>×{s}</option>)}
      </select>

      <input
        type="range"
        aria-label="Момент воспроизведения"
        className="min-w-48 flex-1 accent-amber-500"
        min={from}
        max={to}
        step={1000}
        value={Math.min(Math.max(shown, from), to)}
        onChange={e => setScrub(Number(e.target.value))}
        onPointerUp={commitScrub}
        onKeyUp={commitScrub}
      />

      <span className="font-mono tabular-nums">{formatCursor(shown)}</span>

      {(loading || buffering) && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <Loader2 size={12} className="animate-spin" />
          Загрузка…
        </span>
      )}
      {ended && !loading && <span className="text-neutral-500">Конец периода</span>}
      {error && <span className="text-red-600 dark:text-red-400">{error}</span>}

      <span
        className="ml-auto flex items-center gap-1 text-neutral-500"
        title="Архив хранит значения тегов. Свойства, которые серверные скрипты вычисляют сами, в него не попадают — зависящие от них привязки в архиве не срабатывают."
      >
        <Info size={12} />
        Только теги; действия выключены
      </span>
    </div>
  );
}
