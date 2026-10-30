"use client";

import React, {useEffect, useState} from "react";
import {Info, Pause, Play} from "lucide-react";
import {Spinner} from "@/shared/ui/Spinner";
import {REPLAY_SPEEDS, useArchiveReplayStore} from "../model/useArchiveReplayStore";
import type {ArchiveReplayControls} from "../model/archive/useArchiveReplay";
import {ARCHIVE_DEPTH_MS} from "../model/archive/archive";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";

/** `datetime-local` работает в местном времени без пояса. */
const toLocalInput = (ts: number) =>
  new Date(ts - new Date(ts).getTimezoneOffset() * 60_000).toISOString().slice(0, 19);

const fromLocalInput = (v: string) => new Date(v).getTime();

const formatCursor = (ts: number) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU")}`;
};

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
        <Input size="sm" className="w-auto" type="datetime-local" step={1} value={draftFrom} min={oldest}
          onChange={e => setDraftFrom(e.target.value)} />
      </label>
      <label className="flex items-center gap-1.5">
        по
        <Input size="sm" className="w-auto" type="datetime-local" step={1} value={draftTo} min={oldest}
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

      <Select
        aria-label="Скорость"
        size="sm"
        className="w-20"
        value={String(speed)}
        onValueChange={v => controls.setSpeed(Number(v))}
        options={REPLAY_SPEEDS.map(s => ({value: String(s), label: `×${s}`}))}
      />

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
        <Spinner size={12} label="Загрузка…" className="gap-1 text-xs text-warning" />
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
